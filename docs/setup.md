# FlagForge 环境搭建指南

## 依赖总览

| 组件 | 版本要求 | 用途 |
|------|---------|------|
| Go | >= 1.21 | 后端服务 |
| Node.js | >= 20 | Web 管理后台 |
| MySQL | 8.x | 数据库 |
| CMake | >= 3.14 | C++ SDK 构建 |
| Docker / Docker Compose | 最新版 | 容器化部署（可选） |

---

## 方式一：Docker Compose 一键启动（推荐）

### 1. 安装 Docker

- Windows: [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Linux:
  ```bash
  curl -fsSL https://get.docker.com | sh
  ```

### 2. 启动服务

```bash
cd FlagForge
docker compose -f deploy/docker-compose.yml up --build
```

启动后：
- 后端: http://localhost:8080
- 前端: http://localhost:3000
- MySQL: localhost:3306 (user: root, password: root, database: flagforge)

### 3. 初始化数据库

首次启动后执行：

```bash
docker exec -i flagforge-mysql-1 mysql -uroot -proot < deploy/init.sql
```

### 4. 停止服务

```bash
docker compose -f deploy/docker-compose.yml down
```

---

## 方式二：本地开发环境

### 1. 后端（Go）

#### 安装 Go

- Windows: `winget install GoLang.Go`
- macOS: `brew install go`
- Linux: https://go.dev/dl/

验证：

```bash
go version   # >= 1.21
```

#### 安装 MySQL

- Windows: `winget install Oracle.MySQL`
- macOS: `brew install mysql`
- Docker: `docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=flagforge mysql:8`

创建数据库：

```bash
mysql -uroot -proot < deploy/init.sql
```

#### 启动后端

```bash
cd backend
go mod tidy
go run main.go
```

后端运行于 http://localhost:8080

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

前端运行于 http://localhost:3000，API 请求自动代理到 :8080。

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

#### 构建示例

```bash
cd example/cpp
g++ -std=c++17 -I ../../sdk/cpp/include main.cpp ../../sdk/cpp/src/feature_manager.cpp -o demo
./demo
```

---

## 常见问题

### Q: 后端启动报数据库连接失败

确认 MySQL 已启动，并检查连接参数。本地开发默认连接 `root:root@tcp(127.0.0.1:3306)/flagforge`。

### Q: 前端 npm install 慢

切换 npm 镜像：

```bash
npm config set registry https://registry.npmmirror.com
```

### Q: C++ 编译报 C++17 不支持

确认编译器版本：GCC >= 7、Clang >= 5、MSVC >= 19.14（VS 2017 15.7+）。
