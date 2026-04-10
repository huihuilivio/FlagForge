"""
FlagForge API 全接口测试脚本
用法: python scripts/test_api.py [base_url] [--cover]
默认: http://localhost:8080
要求: pip install requests

自动管理后端进程：
  - 检测后端是否已在运行
  - 若未运行，自动清理旧 DB 并启动后端
  - 测试结束后自动关闭由脚本启动的后端

覆盖率统计：
  - API 接口覆盖率：自动统计本次测试命中的路由 vs 全部已注册路由
  - Go 代码覆盖率（--cover）：用 go build -cover 编译，测试结束后输出覆盖率报告
"""

import sys
import os
import re
import json
import time
import signal
import socket
import shutil
import tempfile
import subprocess
import atexit
import requests

BASE = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else "http://localhost:8080"
COVER_MODE = "--cover" in sys.argv
PASS = 0
FAIL = 0

_backend_proc = None  # 由脚本启动的后端进程
_cover_dir = None     # GOCOVERDIR 临时目录
_backend_dir = None   # backend 目录路径

# ============================
#  全部已注册路由（与 router.go 保持同步）
# ============================
ALL_ROUTES = {
    # Client
    ("GET",    "/api/v1/features"),
    ("PUT",    "/api/v1/override"),
    ("DELETE", "/api/v1/override"),
    ("GET",    "/api/v1/overrides"),
    # Admin - App
    ("GET",    "/admin/apps"),
    ("POST",   "/admin/app"),
    ("PUT",    "/admin/app/:id"),
    ("DELETE", "/admin/app/:id"),
    # Admin - Env
    ("GET",    "/admin/apps/:app_id/envs"),
    ("POST",   "/admin/apps/:app_id/env"),
    ("PUT",    "/admin/env/:id"),
    ("DELETE", "/admin/env/:id"),
    # Admin - Feature
    ("GET",    "/admin/features"),
    ("POST",   "/admin/feature"),
    ("PUT",    "/admin/feature/:id"),
    ("DELETE", "/admin/feature/:id"),
    # Admin - Rule
    ("GET",    "/admin/rules"),
    ("POST",   "/admin/rule"),
    ("PUT",    "/admin/rule/:id"),
    ("DELETE", "/admin/rule/:id"),
    # Admin - Audit
    ("GET",    "/admin/audit-logs"),
}

# 记录测试过程中命中的路由
_hit_routes = set()

# 将实际请求路径归一化到路由模式
_ROUTE_PATTERNS = [
    (re.compile(r"^/admin/apps/[^/]+/envs$"),    "/admin/apps/:app_id/envs"),
    (re.compile(r"^/admin/apps/[^/]+/env$"),      "/admin/apps/:app_id/env"),
    (re.compile(r"^/admin/app/[^/]+$"),           "/admin/app/:id"),
    (re.compile(r"^/admin/env/[^/]+$"),           "/admin/env/:id"),
    (re.compile(r"^/admin/feature/[^/]+$"),       "/admin/feature/:id"),
    (re.compile(r"^/admin/rule/[^/]+$"),          "/admin/rule/:id"),
]


def _normalize_path(path: str) -> str:
    """将带数字 ID 的路径还原为路由模式"""
    for pattern, template in _ROUTE_PATTERNS:
        if pattern.match(path):
            return template
    return path


def _parse_host_port(base_url: str):
    """从 base_url 中解析 host 和 port"""
    from urllib.parse import urlparse
    parsed = urlparse(base_url)
    host = parsed.hostname or "localhost"
    port = parsed.port or 8080
    return host, port


def _is_port_open(host: str, port: int) -> bool:
    """检测端口是否已被监听"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        return s.connect_ex((host, port)) == 0


def _wait_for_server(host: str, port: int, timeout: int = 15) -> bool:
    """轮询等待后端就绪"""
    deadline = time.time() + timeout
    while time.time() < deadline:
        if _is_port_open(host, port):
            return True
        time.sleep(0.3)
    return False


def _start_backend():
    """启动后端进程，返回 Popen 对象"""
    global _backend_proc, _cover_dir, _backend_dir

    # 定位 backend 目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    _backend_dir = os.path.normpath(os.path.join(script_dir, "..", "backend"))
    if not os.path.isdir(_backend_dir):
        print(f"[backend] 找不到 backend 目录: {_backend_dir}")
        sys.exit(1)

    # 清理旧 DB
    db_path = os.path.join(_backend_dir, "flagforge.db")
    if os.path.exists(db_path):
        os.remove(db_path)
        print(f"[backend] 已删除旧数据库: {db_path}")

    env = os.environ.copy()

    if COVER_MODE:
        # 用 -cover 编译可执行文件
        bin_name = "flagforge_cover.exe" if sys.platform == "win32" else "flagforge_cover"
        bin_path = os.path.join(_backend_dir, bin_name)
        print(f"[cover] 编译带覆盖率的二进制: go build -cover -o {bin_name}")
        result = subprocess.run(
            ["go", "build", "-cover", "-o", bin_name, "."],
            cwd=_backend_dir,
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            print(f"[cover] 编译失败:\n{result.stderr}")
            sys.exit(1)

        _cover_dir = tempfile.mkdtemp(prefix="flagforge_cov_")
        env["GOCOVERDIR"] = _cover_dir
        print(f"[cover] GOCOVERDIR={_cover_dir}")

        print(f"[backend] 启动后端: {bin_name} (cwd={_backend_dir})")
        _backend_proc = subprocess.Popen(
            [bin_path],
            cwd=_backend_dir,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
        )
    else:
        # 普通模式
        print(f"[backend] 启动后端: go run . (cwd={_backend_dir})")
        _backend_proc = subprocess.Popen(
            ["go", "run", "."],
            cwd=_backend_dir,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
        )

    atexit.register(_stop_backend)

    host, port = _parse_host_port(BASE)
    if not _wait_for_server(host, port):
        print("[backend] 超时：后端未能在 15 秒内启动")
        _stop_backend()
        sys.exit(1)
    print(f"[backend] 后端已就绪 ({host}:{port})")


def _stop_backend():
    """关闭由脚本启动的后端进程"""
    global _backend_proc, _cover_dir
    if _backend_proc is None:
        return
    proc = _backend_proc
    _backend_proc = None
    if proc.poll() is not None:
        return
    print("[backend] 正在关闭后端进程…")
    if sys.platform == "win32":
        # 发送 CTRL_BREAK_EVENT 让 Go runtime 优雅退出（刷新 coverage 数据）
        os.kill(proc.pid, signal.CTRL_BREAK_EVENT)
    else:
        proc.send_signal(signal.SIGINT)
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()
    print("[backend] 后端已关闭")

    # 生成代码覆盖率报告
    if _cover_dir and _backend_dir:
        _report_code_coverage()


def _report_code_coverage():
    """用 go tool covdata 生成代码覆盖率报告"""
    global _cover_dir, _backend_dir
    print(f"\n{'=' * 50}")
    print("Go 代码覆盖率报告")
    print(f"{'=' * 50}")

    # 检查覆盖率数据文件是否存在
    cov_files = [f for f in os.listdir(_cover_dir) if not f.startswith(".")] if os.path.isdir(_cover_dir) else []
    if not cov_files:
        print("[cover] GOCOVERDIR 中无覆盖率数据文件。")
        print("[cover] 提示：后端进程可能未能优雅退出。")
        shutil.rmtree(_cover_dir, ignore_errors=True)
        _cover_dir = None
        return

    # percent 摘要
    result = subprocess.run(
        ["go", "tool", "covdata", "percent", "-i", _cover_dir],
        cwd=_backend_dir,
        capture_output=True, text=True,
    )
    if result.returncode == 0 and result.stdout.strip():
        print(result.stdout.strip())
    else:
        err = result.stderr.strip() or "(empty output)"
        print(f"[cover] go tool covdata percent 失败: {err}")

    # 转为 textfmt 以便 go tool cover 进一步分析
    cover_profile = os.path.join(_backend_dir, "coverage.out")
    result2 = subprocess.run(
        ["go", "tool", "covdata", "textfmt", "-i", _cover_dir, "-o", cover_profile],
        cwd=_backend_dir,
        capture_output=True, text=True,
    )
    if result2.returncode == 0:
        print(f"\n覆盖率文件已生成: {cover_profile}")
        print("查看详细 HTML 报告: go tool cover -html=coverage.out")
    else:
        print(f"[cover] textfmt 失败: {result2.stderr.strip()}")

    # 总覆盖率
    result3 = subprocess.run(
        ["go", "tool", "cover", "-func", cover_profile],
        cwd=_backend_dir,
        capture_output=True, text=True,
    )
    if result3.returncode == 0:
        lines = result3.stdout.strip().splitlines()
        # 打印最后一行（total）
        if lines:
            print(f"\n{lines[-1]}")

    # 清理临时目录
    shutil.rmtree(_cover_dir, ignore_errors=True)
    _cover_dir = None

    # 清理编译的二进制
    bin_name = "flagforge_cover.exe" if sys.platform == "win32" else "flagforge_cover"
    bin_path = os.path.join(_backend_dir, bin_name)
    if os.path.exists(bin_path):
        os.remove(bin_path)


def ensure_backend():
    """确保后端正在运行：已启动则复用，否则自动启动"""
    host, port = _parse_host_port(BASE)
    if _is_port_open(host, port):
        print(f"[backend] 检测到后端已在运行 ({host}:{port})，直接复用")
        return
    print(f"[backend] 端口 {host}:{port} 未监听，自动启动后端…")
    _start_backend()


def test(name, method, path, *, json_body=None, params=None, expect_status=200, expect_fn=None):
    global PASS, FAIL
    url = f"{BASE}{path}"

    # 记录路由命中
    normalized = _normalize_path(path)
    _hit_routes.add((method.upper(), normalized))

    try:
        resp = requests.request(method, url, json=json_body, params=params, timeout=5)
    except Exception as e:
        print(f"  FAIL  {name} - {e}")
        FAIL += 1
        return None

    ok = resp.status_code == expect_status
    data = None
    try:
        data = resp.json()
    except Exception:
        pass

    if ok and expect_fn:
        try:
            ok = expect_fn(data)
        except Exception:
            ok = False

    status = "  OK  " if ok else "  FAIL"
    detail = f"status={resp.status_code}"
    if not ok:
        detail += f" expected={expect_status}"
        if data:
            detail += f" body={json.dumps(data, ensure_ascii=False)[:200]}"
    print(f"{status}  {name}  ({detail})")

    if ok:
        PASS += 1
    else:
        FAIL += 1
    return data


def main():
    ensure_backend()

    print(f"\nFlagForge API Test — {BASE}\n{'=' * 50}\n")

    # ========== Admin: App ==========
    print("--- App ---")
    app = test("Create App", "POST", "/admin/app",
               json_body={"app_key": "test_app", "name": "Test App", "description": "for testing"},
               expect_status=201,
               expect_fn=lambda d: d["app_key"] == "test_app" and d["id"] > 0)
    app_id = app["id"] if app else 1

    test("List Apps", "GET", "/admin/apps",
         expect_fn=lambda d: isinstance(d, list) and len(d) > 0)

    test("Update App", "PUT", f"/admin/app/{app_id}",
         json_body={"name": "Test App (updated)", "description": "updated desc"},
         expect_fn=lambda d: "updated" in d.get("name", ""))

    # ========== Admin: Environment ==========
    print("\n--- Environment ---")
    env = test("Create Env (dev)", "POST", f"/admin/apps/{app_id}/env",
               json_body={"env_key": "dev", "name": "Development"},
               expect_status=201,
               expect_fn=lambda d: d["env_key"] == "dev")
    env_id = env["id"] if env else 1

    test("Create Env (prod)", "POST", f"/admin/apps/{app_id}/env",
         json_body={"env_key": "prod", "name": "Production", "is_production": True},
         expect_status=201)

    env_prod = test("Create Env (staging)", "POST", f"/admin/apps/{app_id}/env",
         json_body={"env_key": "staging", "name": "Staging"},
         expect_status=201)
    env_staging_id = env_prod["id"] if env_prod else 99

    test("List Envs", "GET", f"/admin/apps/{app_id}/envs",
         expect_fn=lambda d: isinstance(d, list) and len(d) == 3)

    test("Update Env", "PUT", f"/admin/env/{env_id}",
         json_body={"name": "Development (updated)"},
         expect_fn=lambda d: "updated" in d.get("name", ""))

    test("Delete Env (staging)", "DELETE", f"/admin/env/{env_staging_id}",
         expect_fn=lambda d: d.get("message") == "deleted")

    test("List Envs after delete", "GET", f"/admin/apps/{app_id}/envs",
         expect_fn=lambda d: isinstance(d, list) and len(d) == 2)

    # ========== Admin: Feature ==========
    print("\n--- Feature ---")
    feat = test("Create Feature (dark_mode)", "POST", "/admin/feature",
                json_body={"app_id": app_id, "key_name": "dark_mode", "value_type": "boolean", "description": "Dark mode toggle"},
                expect_status=201,
                expect_fn=lambda d: d["key_name"] == "dark_mode")
    feat_id = feat["id"] if feat else 1

    feat2 = test("Create Feature (welcome_text)", "POST", "/admin/feature",
                 json_body={"app_id": app_id, "key_name": "welcome_text", "value_type": "string", "description": "Welcome message"},
                 expect_status=201)
    feat2_id = feat2["id"] if feat2 else 2

    test("List Features (by app)", "GET", "/admin/features",
         params={"app_id": app_id},
         expect_fn=lambda d: isinstance(d, list) and len(d) == 2)

    test("Update Feature", "PUT", f"/admin/feature/{feat_id}",
         json_body={"description": "Dark mode toggle (updated)"},
         expect_fn=lambda d: "updated" in d.get("description", ""))

    # ========== Admin: List Rules ==========
    print("\n--- List Rules ---")

    test("List Rules (no filter)", "GET", "/admin/rules",
         params={"app_id": app_id},
         expect_fn=lambda d: isinstance(d, list))

    # ========== Admin: Targeting Rule ==========
    print("\n--- Targeting Rule ---")

    # Rule 1: whitelist alice,bob → enabled
    rule1 = test("Create Rule (whitelist)", "POST", "/admin/rule",
                 json_body={
                     "feature_id": feat_id, "env_id": env_id,
                     "name": "Whitelist alice & bob", "priority": 0, "active": True,
                     "conditions": json.dumps([{"type": "user_list", "value": ["alice", "bob"]}]),
                     "enabled": True, "value": ""
                 },
                 expect_status=201,
                 expect_fn=lambda d: d["name"] == "Whitelist alice & bob")
    rule1_id = rule1["id"] if rule1 else 1

    # Rule 2: percentage 1% (low enough to not hit charlie)
    test("Create Rule (1% rollout)", "POST", "/admin/rule",
         json_body={
             "feature_id": feat_id, "env_id": env_id,
             "name": "1% rollout", "priority": 50, "active": True,
             "conditions": json.dumps([{"type": "percentage", "value": 1}]),
             "enabled": True, "value": ""
         },
         expect_status=201)

    # Rule 3: baseline off
    test("Create Rule (baseline off)", "POST", "/admin/rule",
         json_body={
             "feature_id": feat_id, "env_id": env_id,
             "name": "Baseline off", "priority": 100, "active": True,
             "conditions": "[]",
             "enabled": False, "value": ""
         },
         expect_status=201)

    # Rule for welcome_text: AND/OR combo
    test("Create Rule (AND/OR combo)", "POST", "/admin/rule",
         json_body={
             "feature_id": feat2_id, "env_id": env_id,
             "name": "VIP iOS users", "priority": 0, "active": True,
             "conditions": json.dumps({
                 "op": "and",
                 "items": [
                     {"type": "user_list", "value": ["alice"]},
                     {"op": "or", "items": [
                         {"type": "platform", "value": "ios"},
                         {"type": "version", "value": ">=2.0.0"}
                     ]}
                 ]
             }),
             "enabled": True, "value": "Hello VIP!"
         },
         expect_status=201)

    # welcome_text baseline
    test("Create Rule (welcome_text baseline)", "POST", "/admin/rule",
         json_body={
             "feature_id": feat2_id, "env_id": env_id,
             "name": "Baseline", "priority": 100, "active": True,
             "conditions": "[]",
             "enabled": True, "value": "Hello!"
         },
         expect_status=201)

    test("Update Rule", "PUT", f"/admin/rule/{rule1_id}",
         json_body={
             "feature_id": feat_id, "env_id": env_id,
             "name": "Whitelist (updated)", "priority": 0, "active": True,
             "conditions": json.dumps([{"type": "user_list", "value": ["alice", "bob", "dave"]}]),
             "enabled": True, "value": ""
         },
         expect_fn=lambda d: "updated" in d.get("name", ""))

    # ========== Client: Feature Evaluation ==========
    print("\n--- Feature Evaluation ---")

    test("Eval alice (whitelist → true)", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "alice", "version": "2.1.0", "platform": "ios"},
         expect_fn=lambda d: d["dark_mode"]["enabled"] is True)

    test("Eval alice welcome_text (AND/OR → VIP)", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "alice", "version": "2.1.0", "platform": "ios"},
         expect_fn=lambda d: d["welcome_text"]["enabled"] is True and d["welcome_text"]["value"] == "Hello VIP!")

    test("Eval charlie (baseline → false)", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "charlie"},
         expect_fn=lambda d: d["dark_mode"]["enabled"] is False)

    test("Eval charlie welcome_text (baseline → Hello!)", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "charlie"},
         expect_fn=lambda d: d["welcome_text"]["value"] == "Hello!")

    test("Eval alice NOT ios (OR branch: version>=2.0)", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "alice", "version": "2.5.0", "platform": "android"},
         expect_fn=lambda d: d["welcome_text"]["value"] == "Hello VIP!")

    test("Eval alice old version non-ios (AND fails)", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "alice", "version": "1.0.0", "platform": "android"},
         expect_fn=lambda d: d["welcome_text"]["value"] == "Hello!")

    test("Eval with attr_region", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "bob", "attr_region": "cn"},
         expect_fn=lambda d: d["dark_mode"]["enabled"] is True)

    test("Eval missing params → 400", "GET", "/api/v1/features",
         expect_status=400)

    # ========== Client: User Override ==========
    print("\n--- User Override ---")

    test("charlie override dark_mode=true", "PUT", "/api/v1/override",
         json_body={"app_id": app_id, "env_id": env_id, "feature_id": feat_id, "user_id": "charlie", "enabled": True},
         expect_fn=lambda d: d["enabled"] is True)

    test("Eval charlie after override (→ true)", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "charlie"},
         expect_fn=lambda d: d["dark_mode"]["enabled"] is True)

    test("charlie update override to false", "PUT", "/api/v1/override",
         json_body={"app_id": app_id, "env_id": env_id, "feature_id": feat_id, "user_id": "charlie", "enabled": False},
         expect_fn=lambda d: d["enabled"] is False)

    test("Eval charlie after update (→ false)", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "charlie"},
         expect_fn=lambda d: d["dark_mode"]["enabled"] is False)

    test("List charlie overrides", "GET", "/api/v1/overrides",
         params={"app_id": app_id, "env_id": env_id, "user_id": "charlie"},
         expect_fn=lambda d: isinstance(d, list) and len(d) == 1)

    test("Delete charlie override", "DELETE", "/api/v1/override",
         params={"app_id": app_id, "env_id": env_id, "feature_id": feat_id, "user_id": "charlie"},
         expect_fn=lambda d: d.get("message") == "override deleted")

    test("Eval charlie after delete (→ baseline false)", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "charlie"},
         expect_fn=lambda d: d["dark_mode"]["enabled"] is False)

    test("Override missing params → 400", "PUT", "/api/v1/override",
         json_body={"user_id": "x"},
         expect_status=400)

    # ========== Error Branches: Invalid IDs ==========
    print("\n--- Error Branches: Invalid IDs ---")

    test("Update Feature invalid id → 400", "PUT", "/admin/feature/abc",
         json_body={"description": "test"},
         expect_status=400,
         expect_fn=lambda d: "invalid id" in d.get("error", ""))

    test("Delete Feature invalid id → 400", "DELETE", "/admin/feature/abc",
         expect_status=400,
         expect_fn=lambda d: "invalid id" in d.get("error", ""))

    test("Update Feature not found → 404", "PUT", "/admin/feature/999999",
         json_body={"description": "ghost"},
         expect_status=404,
         expect_fn=lambda d: "not found" in d.get("error", ""))

    test("Update Rule invalid id → 400", "PUT", "/admin/rule/abc",
         json_body={"name": "test"},
         expect_status=400,
         expect_fn=lambda d: "invalid id" in d.get("error", ""))

    test("Delete Rule invalid id → 400", "DELETE", "/admin/rule/abc",
         expect_status=400,
         expect_fn=lambda d: "invalid id" in d.get("error", ""))

    test("List Envs invalid app_id → 400", "GET", "/admin/apps/abc/envs",
         expect_status=400,
         expect_fn=lambda d: "invalid app_id" in d.get("error", ""))

    test("Create Env invalid app_id → 400", "POST", "/admin/apps/abc/env",
         json_body={"env_key": "x", "name": "X"},
         expect_status=400,
         expect_fn=lambda d: "invalid app_id" in d.get("error", ""))

    # ========== Error Branches: Bad JSON ==========
    print("\n--- Error Branches: Bad JSON ---")

    test("Create Feature bad json → 400", "POST", "/admin/feature",
         json_body="not_a_json_object",
         expect_status=400)

    test("Create Rule bad json → 400", "POST", "/admin/rule",
         json_body="not_valid",
         expect_status=400)

    test("Update Rule bad json → 400", "PUT", f"/admin/rule/{rule1_id}",
         json_body="not_valid",
         expect_status=400)

    test("Create App bad json → 400", "POST", "/admin/app",
         json_body="not_valid",
         expect_status=400)

    test("Create Env bad json → 400", "POST", f"/admin/apps/{app_id}/env",
         json_body="not_valid",
         expect_status=400)

    test("Set Override bad json → 400", "PUT", "/api/v1/override",
         json_body="not_valid",
         expect_status=400)

    # ========== Error Branches: Override/Overrides missing params ==========
    print("\n--- Error Branches: Override Missing Params ---")

    test("Delete Override missing params → 400", "DELETE", "/api/v1/override",
         expect_status=400,
         expect_fn=lambda d: "required" in d.get("error", ""))

    test("List Overrides missing params → 400", "GET", "/api/v1/overrides",
         expect_status=400,
         expect_fn=lambda d: "required" in d.get("error", ""))

    test("Delete Override partial params → 400", "DELETE", "/api/v1/override",
         params={"app_id": app_id, "env_id": env_id},
         expect_status=400)

    test("List Overrides partial params → 400", "GET", "/api/v1/overrides",
         params={"app_id": app_id},
         expect_status=400)

    # ========== Eval: Non-existent app/env → 404 ==========
    print("\n--- Error Branches: Eval Errors ---")

    test("Eval non-existent app → 404", "GET", "/api/v1/features",
         params={"app_key": "no_such_app", "env_key": "dev", "user_id": "alice"},
         expect_status=404)

    test("Eval non-existent env → 404", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "no_such_env", "user_id": "alice"},
         expect_status=404)

    # ========== Condition Engine: Advanced Coverage ==========
    print("\n--- Condition Engine: Advanced Coverage ---")

    # matchAttr (0% → covered)
    rule_attr = test("Create Rule (attr condition)", "POST", "/admin/rule",
                     json_body={
                         "feature_id": feat2_id, "env_id": env_id,
                         "name": "Region CN", "priority": 5, "active": True,
                         "conditions": json.dumps([{"type": "attr", "value": {"key": "region", "value": "cn"}}]),
                         "enabled": True, "value": "你好中国!"
                     },
                     expect_status=201)
    rule_attr_id = rule_attr["id"] if rule_attr else 999

    test("Eval attr match (region=cn)", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "nobody", "attr_region": "cn"},
         expect_fn=lambda d: d["welcome_text"]["value"] == "你好中国!")

    test("Eval attr no match (region=us)", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "nobody", "attr_region": "us"},
         expect_fn=lambda d: d["welcome_text"]["value"] == "Hello!")

    # matchVersion: all operators (48% → covered)
    # <=
    rule_ver_le = test("Create Rule (version <=1.5.0)", "POST", "/admin/rule",
                       json_body={
                           "feature_id": feat2_id, "env_id": env_id,
                           "name": "Old version <=1.5", "priority": 3, "active": True,
                           "conditions": json.dumps([{"type": "version", "value": "<=1.5.0"}]),
                           "enabled": True, "value": "Legacy!"
                       },
                       expect_status=201)
    rule_ver_le_id = rule_ver_le["id"] if rule_ver_le else 999

    test("Eval version <=1.5.0 match", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "nobody", "version": "1.4.0"},
         expect_fn=lambda d: d["welcome_text"]["value"] == "Legacy!")

    test("Eval version <=1.5.0 exact match", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "nobody", "version": "1.5.0"},
         expect_fn=lambda d: d["welcome_text"]["value"] == "Legacy!")

    test("Eval version <=1.5.0 no match", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "nobody", "version": "1.6.0", "attr_region": "xx"},
         expect_fn=lambda d: d["welcome_text"]["value"] != "Legacy!")

    # Delete to avoid interference, add > test
    test("Delete version <=1.5 rule", "DELETE", f"/admin/rule/{rule_ver_le_id}")

    rule_ver_gt = test("Create Rule (version >3.0.0)", "POST", "/admin/rule",
                       json_body={
                           "feature_id": feat2_id, "env_id": env_id,
                           "name": "Future version >3.0", "priority": 2, "active": True,
                           "conditions": json.dumps([{"type": "version", "value": ">3.0.0"}]),
                           "enabled": True, "value": "Future!"
                       },
                       expect_status=201)
    rule_ver_gt_id = rule_ver_gt["id"] if rule_ver_gt else 999

    test("Eval version >3.0.0 match", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "nobody", "version": "3.1.0"},
         expect_fn=lambda d: d["welcome_text"]["value"] == "Future!")

    test("Eval version >3.0.0 no match (exact)", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "nobody", "version": "3.0.0"},
         expect_fn=lambda d: d["welcome_text"]["value"] != "Future!")

    test("Delete version >3.0 rule", "DELETE", f"/admin/rule/{rule_ver_gt_id}")

    # < operator
    rule_ver_lt = test("Create Rule (version <1.0.0)", "POST", "/admin/rule",
                       json_body={
                           "feature_id": feat2_id, "env_id": env_id,
                           "name": "Pre-release <1.0", "priority": 2, "active": True,
                           "conditions": json.dumps([{"type": "version", "value": "<1.0.0"}]),
                           "enabled": True, "value": "Beta!"
                       },
                       expect_status=201)
    rule_ver_lt_id = rule_ver_lt["id"] if rule_ver_lt else 999

    test("Eval version <1.0.0 match", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "nobody", "version": "0.9.0"},
         expect_fn=lambda d: d["welcome_text"]["value"] == "Beta!")

    test("Eval version <1.0.0 no match", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "nobody", "version": "1.0.0"},
         expect_fn=lambda d: d["welcome_text"]["value"] != "Beta!")

    test("Delete version <1.0 rule", "DELETE", f"/admin/rule/{rule_ver_lt_id}")

    # = explicit operator
    rule_ver_eq = test("Create Rule (version =2.0.0)", "POST", "/admin/rule",
                       json_body={
                           "feature_id": feat2_id, "env_id": env_id,
                           "name": "Exact v2.0", "priority": 2, "active": True,
                           "conditions": json.dumps([{"type": "version", "value": "=2.0.0"}]),
                           "enabled": True, "value": "Exact2!"
                       },
                       expect_status=201)
    rule_ver_eq_id = rule_ver_eq["id"] if rule_ver_eq else 999

    test("Eval version =2.0.0 exact match", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "nobody", "version": "2.0.0"},
         expect_fn=lambda d: d["welcome_text"]["value"] == "Exact2!")

    test("Eval version =2.0.0 no match", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "nobody", "version": "2.0.1"},
         expect_fn=lambda d: d["welcome_text"]["value"] != "Exact2!")

    # implicit = (bare version)
    test("Update Rule (version bare 2.0.0)", "PUT", f"/admin/rule/{rule_ver_eq_id}",
         json_body={
             "feature_id": feat2_id, "env_id": env_id,
             "name": "Bare v2.0", "priority": 2, "active": True,
             "conditions": json.dumps([{"type": "version", "value": "2.0.0"}]),
             "enabled": True, "value": "Bare2!"
         })

    test("Eval version bare 2.0.0 match", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "nobody", "version": "2.0.0"},
         expect_fn=lambda d: d["welcome_text"]["value"] == "Bare2!")

    test("Delete version = rule", "DELETE", f"/admin/rule/{rule_ver_eq_id}")

    # matchVersion: no version in context
    rule_ver_no = test("Create Rule (version needs ctx)", "POST", "/admin/rule",
                       json_body={
                           "feature_id": feat2_id, "env_id": env_id,
                           "name": "Need version", "priority": 2, "active": True,
                           "conditions": json.dumps([{"type": "version", "value": ">=1.0.0"}]),
                           "enabled": True, "value": "HasVer!"
                       },
                       expect_status=201)
    rule_ver_no_id = rule_ver_no["id"] if rule_ver_no else 999

    test("Eval no version in ctx → skip rule", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "nobody"},
         expect_fn=lambda d: d["welcome_text"]["value"] != "HasVer!")

    test("Delete need-version rule", "DELETE", f"/admin/rule/{rule_ver_no_id}")

    # matchPercentage: custom key format {"pct":..., "key":...}
    rule_pct = test("Create Rule (pct custom key)", "POST", "/admin/rule",
                    json_body={
                        "feature_id": feat2_id, "env_id": env_id,
                        "name": "Custom pct key", "priority": 4, "active": True,
                        "conditions": json.dumps([{"type": "percentage", "value": {"pct": 100, "key": "exp_abc"}}]),
                        "enabled": True, "value": "PctKey!"
                    },
                    expect_status=201)
    rule_pct_id = rule_pct["id"] if rule_pct else 999

    test("Eval pct custom key 100% → match", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "test_user"},
         expect_fn=lambda d: d["welcome_text"]["value"] == "PctKey!")

    test("Delete pct custom key rule", "DELETE", f"/admin/rule/{rule_pct_id}")

    # matchPercentage: no user_id → false
    rule_pct2 = test("Create Rule (pct no user)", "POST", "/admin/rule",
                     json_body={
                         "feature_id": feat2_id, "env_id": env_id,
                         "name": "Pct needs user", "priority": 4, "active": True,
                         "conditions": json.dumps([{"type": "percentage", "value": 100}]),
                         "enabled": True, "value": "PctNoUser!"
                     },
                     expect_status=201)
    rule_pct2_id = rule_pct2["id"] if rule_pct2 else 999

    test("Eval pct without user_id → skip", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev"},
         expect_fn=lambda d: d["welcome_text"]["value"] != "PctNoUser!")

    test("Delete pct-no-user rule", "DELETE", f"/admin/rule/{rule_pct2_id}")

    # matchUserList: empty user_id → false
    test("Eval user_list without user_id → baseline", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev"},
         expect_fn=lambda d: d["dark_mode"]["enabled"] is False)

    # Unknown condition type → falls through to baseline
    rule_unk = test("Create Rule (unknown type)", "POST", "/admin/rule",
                    json_body={
                        "feature_id": feat2_id, "env_id": env_id,
                        "name": "Unknown type", "priority": 4, "active": True,
                        "conditions": json.dumps([{"type": "unknown_type", "value": "whatever"}]),
                        "enabled": True, "value": "Unknown!"
                    },
                    expect_status=201)
    rule_unk_id = rule_unk["id"] if rule_unk else 999

    test("Eval unknown condition type → skip to baseline", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "alice"},
         expect_fn=lambda d: d["welcome_text"]["value"] != "Unknown!")

    test("Delete unknown-type rule", "DELETE", f"/admin/rule/{rule_unk_id}")

    # Unknown op in group node → false
    rule_badop = test("Create Rule (bad op)", "POST", "/admin/rule",
                      json_body={
                          "feature_id": feat2_id, "env_id": env_id,
                          "name": "Bad op", "priority": 4, "active": True,
                          "conditions": json.dumps({"op": "xor", "items": [{"type": "user_list", "value": ["alice"]}]}),
                          "enabled": True, "value": "BadOp!"
                      },
                      expect_status=201)
    rule_badop_id = rule_badop["id"] if rule_badop else 999

    test("Eval bad op → skip to baseline", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "alice"},
         expect_fn=lambda d: d["welcome_text"]["value"] != "BadOp!")

    test("Delete bad-op rule", "DELETE", f"/admin/rule/{rule_badop_id}")

    # Malformed conditions JSON → now rejected at write time
    test("Create Rule (malformed conditions) → 400", "POST", "/admin/rule",
         json_body={
             "feature_id": feat2_id, "env_id": env_id,
             "name": "Bad JSON", "priority": 4, "active": True,
             "conditions": "{invalid json!!!",
             "enabled": True, "value": "Bad!"
         },
         expect_status=400,
         expect_fn=lambda d: "conditions" in d.get("error", ""))

    # parseConditions: "null" input → match all
    rule_null = test("Create Rule (null conditions)", "POST", "/admin/rule",
                     json_body={
                         "feature_id": feat2_id, "env_id": env_id,
                         "name": "Null cond", "priority": 1, "active": True,
                         "conditions": "null",
                         "enabled": True, "value": "NullCond!"
                     },
                     expect_status=201)
    rule_null_id = rule_null["id"] if rule_null else 999

    test("Eval null conditions → match all (highest prio)", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "anyone"},
         expect_fn=lambda d: d["welcome_text"]["value"] == "NullCond!")

    test("Delete null-cond rule", "DELETE", f"/admin/rule/{rule_null_id}")

    # platform mismatch (matchStringEquals returns false)
    test("Eval platform mismatch", "GET", "/api/v1/features",
         params={"app_key": "test_app", "env_key": "dev", "user_id": "nobody", "version": "2.1.0", "platform": "windows"},
         expect_fn=lambda d: d["welcome_text"]["value"] == "Hello!")

    # Cleanup the attr rule
    test("Delete attr rule", "DELETE", f"/admin/rule/{rule_attr_id}")

    # List Features without app_id (all features)
    test("List Features (all)", "GET", "/admin/features",
         expect_fn=lambda d: isinstance(d, list) and len(d) >= 2)

    # ========== Admin: Audit Logs ==========
    print("\n--- Audit Logs ---")

    test("List Audit Logs", "GET", "/admin/audit-logs",
         expect_fn=lambda d: isinstance(d, dict) and isinstance(d.get("data"), list) and len(d["data"]) > 0)

    test("List Audit Logs (with app filter)", "GET", "/admin/audit-logs",
         params={"app_id": app_id},
         expect_fn=lambda d: isinstance(d, dict) and isinstance(d.get("data"), list))

    test("List Audit Logs (with pagination)", "GET", "/admin/audit-logs",
         params={"limit": 5, "offset": 0},
         expect_fn=lambda d: isinstance(d, dict) and isinstance(d.get("data"), list) and len(d["data"]) <= 5)

    # ========== Admin: List Rules (with filters) ==========
    print("\n--- List Rules (with filters) ---")

    test("List Rules (env filter)", "GET", "/admin/rules",
         params={"app_id": app_id, "env_id": env_id},
         expect_fn=lambda d: isinstance(d, list))

    test("List Rules (feature filter)", "GET", "/admin/rules",
         params={"app_id": app_id, "feature_id": feat_id},
         expect_fn=lambda d: isinstance(d, list))

    # ========== Admin: Delete ==========
    print("\n--- Cleanup ---")

    test("Delete Rule", "DELETE", f"/admin/rule/{rule1_id}",
         expect_fn=lambda d: d.get("message") == "deleted")

    test("Delete Feature", "DELETE", f"/admin/feature/{feat_id}",
         expect_fn=lambda d: d.get("message") == "deleted")

    test("List Features after delete", "GET", "/admin/features",
         params={"app_id": app_id},
         expect_fn=lambda d: isinstance(d, list) and len(d) == 1)

    # ========== Admin: Delete App (cascading) ==========
    print("\n--- Delete App (cascading) ---")

    # Create a temporary app to test cascading delete
    tmp_app = test("Create temp App", "POST", "/admin/app",
                   json_body={"app_key": "tmp_app", "name": "Temp"},
                   expect_status=201)
    tmp_app_id = tmp_app["id"] if tmp_app else 999

    test("Create temp Env", "POST", f"/admin/apps/{tmp_app_id}/env",
         json_body={"env_key": "tmp_env", "name": "Tmp Env"},
         expect_status=201)

    test("Create temp Feature", "POST", "/admin/feature",
         json_body={"app_id": tmp_app_id, "key_name": "tmp_feat", "value_type": "boolean"},
         expect_status=201)

    test("Delete App (cascade)", "DELETE", f"/admin/app/{tmp_app_id}",
         expect_fn=lambda d: d.get("message") == "deleted")

    test("Verify app deleted", "GET", "/admin/apps",
         expect_fn=lambda d: all(a["app_key"] != "tmp_app" for a in d))

    # ========== Error: UpdateApp/DeleteApp/UpdateEnv/DeleteEnv invalid IDs ==========
    print("\n--- Error: New Endpoints Invalid IDs ---")

    test("Update App invalid id → 400", "PUT", "/admin/app/abc",
         json_body={"name": "test"},
         expect_status=400)

    test("Delete App invalid id → 400", "DELETE", "/admin/app/abc",
         expect_status=400)

    test("Update Env invalid id → 400", "PUT", "/admin/env/abc",
         json_body={"name": "test"},
         expect_status=400)

    test("Delete Env invalid id → 400", "DELETE", "/admin/env/abc",
         expect_status=400)

    test("Update App bad json → 400", "PUT", f"/admin/app/{app_id}",
         json_body="not_valid",
         expect_status=400)

    test("Update Env bad json → 400", "PUT", f"/admin/env/{env_id}",
         json_body="not_valid",
         expect_status=400)

    # ========== Summary ==========
    total = PASS + FAIL
    print(f"\n{'=' * 50}")
    print(f"Total: {total}  Passed: {PASS}  Failed: {FAIL}")
    if FAIL > 0:
        print("SOME TESTS FAILED!")
    else:
        print("ALL TESTS PASSED!")

    # ========== API 接口覆盖率 ==========
    _report_api_coverage()

    if FAIL > 0:
        sys.exit(1)


def _report_api_coverage():
    """输出 API 接口覆盖率报告"""
    hit = _hit_routes & ALL_ROUTES
    missed = ALL_ROUTES - _hit_routes
    total = len(ALL_ROUTES)
    covered = len(hit)
    pct = covered / total * 100 if total > 0 else 0

    print(f"\n{'=' * 50}")
    print(f"API 接口覆盖率: {covered}/{total} ({pct:.0f}%)")
    print(f"{'=' * 50}")

    for method, path in sorted(hit):
        print(f"  ✓  {method:7s} {path}")
    for method, path in sorted(missed):
        print(f"  ✗  {method:7s} {path}")

    # 检查测试中是否命中了未注册的路由
    extra = _hit_routes - ALL_ROUTES
    if extra:
        print(f"\n  ⚠  测试中命中了 {len(extra)} 个未注册路由:")
        for method, path in sorted(extra):
            print(f"       {method:7s} {path}")


if __name__ == "__main__":
    main()
