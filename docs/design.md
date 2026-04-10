# Feature Flag Platform 设计文档

## 1. 项目背景

在软件持续迭代过程中，需要一种机制来：

* 动态控制功能开关（无需发版）
* 支持灰度发布（部分用户生效）
* 快速回滚功能（降低风险）
* 支持实验与A/B测试

本项目目标是构建一套完整的 Feature Flag 平台，包含：

* 后端配置中心
* Web 管理后台
* C++ 客户端 SDK

---

## 2. 系统目标

### 2.1 功能目标

* Feature 开关控制（on/off + 自定义值）
* 灰度发布（按用户 / 百分比 / 自定义 rollout key）
* 白名单控制（user_list 条件）
* 版本定向（>=、<=、>、<、= 全运算符）
* 平台定向（ios / android / windows）
* 扩展属性匹配（region、channel 等自定义 attr）
* 用户级覆盖（用户自行开关 feature，优先级最高）
* 递归条件树（AND/OR 任意嵌套）
* 多应用 / 多环境支持
* 动态更新（热更新）

### 2.2 非功能目标

* 高可用（服务挂掉仍可运行）
* 低延迟（本地判断）
* 易扩展（支持未来 A/B 测试）
* 可观测（审计日志）

---

## 3. 系统架构

```
                ┌──────────────────────┐
                │   Web Admin Console  │
                │  (React + Ant Design)│
                └─────────┬────────────┘
                          │ REST API (Admin)
                          ▼
                ┌──────────────────────┐
                │ Feature Config Server│
                │  (Go + Gin + GORM)   │
                │  SQLite / MySQL      │
                └─────────┬────────────┘
                          │ REST API (Client)
        ┌─────────────────┴─────────────────┐
        ▼                                   ▼
┌──────────────┐                    ┌──────────────┐
│  PC Client   │                    │  Server App  │
│ (C++ SDK)    │                    │ Feature SDK  │
└──────────────┘                    └──────────────┘
```

---

## 4. 仓库结构

```
FlagForge/
├── backend/          # Go 配置服务（模块名：goflagforge）
│   ├── api/          # HTTP 接口（Gin handlers）21 个路由
│   ├── service/      # 业务逻辑 + 规则引擎 + 审计记录
│   ├── model/        # GORM 数据模型（6 张表）
│   ├── storage/      # 数据库操作（含级联删除）
│   └── cache/        # 缓存（预留）
├── web/              # React 管理后台（6 个页面）
├── sdk/
│   └── cpp/          # C++ SDK
├── deploy/           # Docker Compose + SQL
├── scripts/          # 测试脚本
├── docs/             # 文档
└── example/          # 示例代码
```

---

## 5. 核心概念

### 5.1 数据模型

```
App → Environment → Feature → TargetingRule
                                    ↑
                           UserFeatureOverride
```

- **App** — 应用（产品），feature flag 的顶层管理单元
- **Environment** — 环境（dev / staging / prod），per-app 级别
- **Feature** — 功能开关，绑定到 App，支持 boolean / string / json 三种值类型
- **TargetingRule** — 定向规则，绑定到 Feature + Environment，按 priority 排序求值
- **UserFeatureOverride** — 用户级覆盖，优先级最高

### 5.2 Conditions DSL

规则的匹配条件使用 JSON 描述，支持递归 AND/OR 嵌套：

```json
{
  "op": "and",
  "items": [
    {"type": "user_list", "value": ["alice"]},
    {
      "op": "or",
      "items": [
        {"type": "platform", "value": "ios"},
        {"type": "version", "value": ">=2.0.0"}
      ]
    }
  ]
}
```

等价于 `user = alice AND (platform = ios OR version >= 2.0.0)`

**三种格式：**

| 格式 | 含义 |
|------|------|
| `[]` 或空 | match all（基线规则） |
| `[{...}, {...}]` | 隐式 AND（裸数组，向后兼容） |
| `{"op":"and/or", "items":[...]}` | 显式条件树 |

**6 种条件类型：**

| type | value 格式 | 说明 |
|------|-----------|------|
| `user_list` | `["alice", "bob"]` | 白名单 |
| `percentage` | `30` 或 `{"pct":30,"key":"exp_abc"}` | 灰度百分比 |
| `version` | `">=2.0.0"` | 版本约束（支持 `>` `>=` `<` `<=` `=`） |
| `platform` | `"ios"` | 平台匹配（不区分大小写） |
| `attr` | `{"key":"region","value":"cn"}` | 扩展属性匹配 |

---

## 6. 后端设计

### 6.1 技术选型

| 组件 | 实现 |
|------|------|
| 语言 | Go 1.24 |
| 框架 | Gin |
| ORM | GORM |
| 数据库 | SQLite（本地开发）/ MySQL（生产） |
| 模块名 | `goflagforge` |

### 6.2 数据库设计

6 张表：`apps`、`environments`、`features`、`feature_targeting_rules`、`user_feature_overrides`、`audit_logs`

详见 [数据库设计文档](database.md)。

### 6.3 API 设计

21 个接口，分为客户端接口和管理接口：

**客户端接口：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/features` | 求值所有 feature 开关状态 |
| PUT | `/api/v1/override` | 用户设置 feature 覆盖 |
| DELETE | `/api/v1/override` | 用户删除 feature 覆盖 |
| GET | `/api/v1/overrides` | 列出用户的所有覆盖 |

**管理接口：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST/PUT/DELETE | `/admin/apps`, `/admin/app[/:id]` | 应用管理（含级联删除） |
| GET/POST | `/admin/apps/:app_id/envs`, `/admin/apps/:app_id/env` | 环境管理 |
| PUT/DELETE | `/admin/env/:id` | 环境更新/删除（含级联删除） |
| GET/POST/PUT/DELETE | `/admin/features`, `/admin/feature[/:id]` | Feature 管理 |
| GET/POST/PUT/DELETE | `/admin/rules`, `/admin/rule[/:id]` | 定向规则管理 |
| GET | `/admin/audit-logs` | 操作审计日志 |

详见 [API 参考文档](api.md)。

### 6.4 规则求值引擎

求值优先级：**用户覆盖 > 定向规则 > 默认值**

```
1. 查询用户级覆盖（UserFeatureOverride），命中则直接返回
2. 按 priority ASC, id ASC 顺序遍历定向规则
3. 对每条规则解析 conditions JSON 为递归条件树
4. evalNode() 递归求值：
   - 组合节点（and/or）→ 递归子节点
   - 叶子节点 → matchLeaf() 分发到具体匹配函数
5. 首条命中的规则终止求值，返回其 enabled + value
6. 无规则命中 → enabled: false
```

灰度百分比使用 `FNV32a(featureKey + \0 + userID) % 100` 计算，featureKey 作为默认盐确保不同 feature 的灰度分配不同。

---

## 7. Web 管理后台

### 7.1 技术选型

* React 18 + Vite 5
* Ant Design 5（UI）
* react-router-dom 6
* axios

### 7.2 主题

浅橙黄风格：主色 `#f5a623`，侧边栏 `#fff8ee`，渐变 Header `#fff3e0→#ffe0b2`

### 7.3 页面

| 路由 | 页面 | 说明 |
|------|------|------|
| `/apps` | 应用管理 | 应用 CRUD，统计卡片 |
| `/envs` | 环境管理 | 环境 CRUD，页面内应用选择器 |
| `/features` | 特性管理 | Feature CRUD，页面内应用+环境选择器，规则抽屉 |
| `/rules` | 规则管理 | 规则 CRUD，页面内应用+环境选择器，条件编辑器 |
| `/query` | 特性查询 | 客户端视角 feature 求值，过滤器模式 |
| `/audit` | 操作审计 | 审计日志查看，分页+类型过滤 |

### 7.4 开发说明

每个管理页面独立管理状态，通过页面内 Select 下拉框选择应用/环境，无全局上下文依赖。

---

## 8. C++ SDK

### 8.1 设计

* 定期从后端拉取 feature 配置
* 本地缓存（文件 + 内存）
* 提供 `isEnabled()` / `getValue()` 接口

### 8.2 状态

接口已设计，实现开发中。

---

## 9. 测试

- 集成测试用例（`scripts/test_api.py`）
- API 接口覆盖率：21/21（100%）
- 测试脚本自动启动/关闭后端，支持 `--cover` 参数
- 审计日志全覆盖：所有 CRUD 操作自动记录到 audit_logs

---

## 8. C++ SDK 设计

### 8.1 目录结构

```
sdk/cpp/
├── include/
├── src/
├── CMakeLists.txt
```

---

### 8.2 核心类

```cpp
class FeatureManager {
public:
    static FeatureManager& instance();

    void init(const std::string& url);

    bool isEnabled(const std::string& key);
    std::string getValue(const std::string& key);

private:
    void loadLocalCache();
    void fetchRemote();

private:
    std::unordered_map<std::string, bool> features_;
};
```

---

### 8.3 初始化流程

```
启动
  ↓
加载本地缓存
  ↓
异步拉取远程配置
  ↓
更新内存 + 写缓存
```

---

### 8.4 本地缓存

文件：

```
feature_cache.json
```

作用：

* 服务不可用时兜底
* 加快启动速度

---

### 8.5 使用方式

```cpp
if (FeatureManager::instance().isEnabled("new_ui")) {
    // 新逻辑
}

std::string theme = FeatureManager::instance().getValue("theme_color");
```

---

## 9. 配置更新机制

### 9.1 轮询（默认）

* 每 10 秒拉取一次

---

### 9.2 推送（进阶）

* WebSocket
* SSE

---

## 10. 容错设计

* 拉取失败 → 使用缓存
* JSON解析失败 → 忽略
* 服务不可用 → 不影响业务

---

## 11. 部署方案

### 11.1 Docker Compose

```yaml
version: '3'
services:
  backend:
    build: ./backend
    ports:
      - "8080:8080"

  web:
    build: ./web
    ports:
      - "3000:3000"

  mysql:
    image: mysql:8
```

---

## 12. 安全设计

* 管理接口鉴权（JWT）
* 操作日志记录
* 权限控制（RBAC）

---

## 13. 日志与监控

建议记录：

* Feature命中日志
* 灰度命中率
* API调用情况

---

## 14. 扩展方向

### 14.1 A/B 测试

```json
{
  "homepage": "A"
}
```

---

### 14.2 实验平台

* 曝光统计
* 转化率分析

---

### 14.3 AI 联动

* 自动调节 Feature
