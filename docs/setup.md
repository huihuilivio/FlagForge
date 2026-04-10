# FlagForge 环境搭建指南

## 依赖总览

| 组件 | 版本要求 | 用途 |
|------|---------|------|
| Go | >= 1.24 | 后端服务 |
| Python 3 | >= 3.8 | 测试脚本（`pip install requests`） |
| Node.js | >= 20 | Web 管理后台 |
| CMake | >= 3.14 | C++ SDK 构建 |
| Docker / Docker Compose | 最新版 | 容器化部署（可选） |

> **注意**: 本地开发使用 **SQLite**，无需安装 MySQL。数据库文件 `flagforge.db` 由 GORM AutoMigrate 自动创建。

---

## 方式一：一键测试（推荐）

最快的启动方式，测试脚本会自动启动后端：

```bash
pip install requests
python scripts/test_api.py
```

脚本会自动：
1. 检测后端是否已在运行
2. 若未运行，清理旧 DB 并启动后端
3. 运行 100 个测试用例
4. 测试结束后关闭后端

### 带代码覆盖率

```bash
python scripts/test_api.py --cover
```

自动用 `go build -cover` 编译，测试结束后输出 Go 代码覆盖率报告。

---

## 方式二：本地开发环境

### 1. 后端（Go）

#### 安装 Go

- Windows: `winget install GoLang.Go`
- macOS: `brew install go`
- Linux: https://go.dev/dl/

验证：

```bash
go version   # >= 1.24
```

#### 启动后端

```bash
cd backend
go mod tidy
go run .
```

后端运行于 http://localhost:8080，数据库文件自动创建 `flagforge.db`。

#### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DB_PATH` | `flagforge.db` | SQLite 数据库文件路径 |

---

### 2. 前端（React + Vite）

#### 安装 Node.js

- Windows: `winget install OpenJS.NodeJS.LTS`
- macOS: `brew install node`
- 或使用 [nvm](https://github.com/nvm-sh/nvm) 管理版本

验证：

```bash
node -v   # >= 20
npm -v
```

#### 启动前端

```bash
cd web
npm install
npm run dev
```

前端运行于 http://localhost:5173，API 请求自动代理到 :8080。

---

### 3. C++ SDK

#### 安装工具链

- **Windows**: 安装 [Visual Studio](https://visualstudio.microsoft.com/) （勾选 "C++ 桌面开发"）或 MinGW
- **macOS**: `xcode-select --install`
- **Linux**: `sudo apt install build-essential cmake` 或 `sudo yum install gcc-c++ cmake`

验证：

```bash
cmake --version   # >= 3.14
g++ --version     # 支持 C++17
```

#### 构建 SDK

```bash
cd sdk/cpp
mkdir build && cd build
cmake ..
cmake --build .
```

#### 运行示例

构建完成后会生成 `flagforge-example`，需要后端运行中：

```bash
./Debug/flagforge-example    # Windows (MSVC)
./flagforge-example          # Linux/macOS
```

---

### 4. C SDK

C SDK 基于 C++ SDK 构建，无需额外依赖。

#### 构建 SDK + 示例

```bash
cd sdk/c
mkdir build && cd build
cmake ..
cmake --build .
```

构建产物：
- `flagforge-c-sdk.lib`（静态库）
- `flagforge-c-example`（可执行示例）

#### 运行示例

```bash
./Debug/flagforge-c-example    # Windows (MSVC)
./flagforge-c-example          # Linux/macOS
```

---

## 方式三：Docker Compose

> **注意**: Docker Compose 使用 SQLite，数据存储在 Docker volume 中。

```bash
cd FlagForge
docker compose -f deploy/docker-compose.yml up --build
```

启动后：
- 后端: http://localhost:8080
- 前端: http://localhost:3000（nginx 反向代理，`/api/` 转发到后端）

```bash
docker compose -f deploy/docker-compose.yml down
```

---

## 常见问题

### Q: 后端启动时表结构怎么创建？

GORM AutoMigrate 自动建表，无需手动执行 SQL。`deploy/init.sql` 仅作为参考。

### Q: 如何切换数据库文件路径？

设置环境变量 `DB_PATH`：

```bash
DB_PATH=/tmp/test.db go run .
```

### Q: 前端 npm install 慢

切换 npm 镜像：

```bash
npm config set registry https://registry.npmmirror.com
```

### Q: C++ 编译报 C++17 不支持

确认编译器版本：GCC >= 7、Clang >= 5、MSVC >= 19.14（VS 2017 15.7+）。
