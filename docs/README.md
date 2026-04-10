# FlagForge - Feature Flag Platform

## 项目结构

```
FlagForge/
├── backend/          # Go 配置服务 (Gin + GORM + SQLite)
│   ├── api/          # HTTP 接口（21 个路由）
│   ├── service/      # 业务逻辑 + 递归条件引擎 + 审计日志
│   ├── model/        # GORM 数据模型（6 张表）
│   ├── storage/      # 数据库操作（含级联删除）
│   └── cache/        # 缓存（预留）
├── web/              # React 管理后台 (Vite 5 + Ant Design 5)
│   └── src/
│       ├── pages/    # 6 个管理页面
│       ├── components/  # 共享组件（RuleDrawer, ConditionEditor, ErrorBoundary）
│       └── utils/    # 工具函数
├── sdk/
│   ├── cpp/          # C++ SDK (C++17, pimpl, 后台轮询, XOR 缓存)
│   └── c/            # C SDK (C11, handle API, extern "C" 封装)
├── example/
│   ├── cpp/          # C++ SDK 示例
│   └── c/            # C SDK 示例
├── deploy/           # Docker Compose + nginx + init SQL
├── scripts/          # 启动/测试脚本
└── docs/             # 文档
    ├── design.md     # 架构设计
    ├── database.md   # 数据库设计
    ├── api.md        # API 参考
    └── setup.md      # 环境搭建
```

## 快速开始

```bash
# 启动后端
cd backend && go run .

# 启动前端（另开终端）
cd web && npm install && npm run dev

# 构建 C++ SDK
cd sdk/cpp && mkdir build && cd build && cmake .. && cmake --build .

# 构建 C SDK
cd sdk/c && mkdir build && cd build && cmake .. && cmake --build .
```

## 服务端口

| 服务     | 端口   | 状态 |
| -------- | ------ | ---- |
| Backend  | :8080  | ✅ 可用 |
| Web      | :5173  | ✅ 可用 |

## Web 管理后台页面

| 路由 | 页面 | 说明 |
|------|------|------|
| `/apps` | 应用管理 | 应用 CRUD，统计卡片 |
| `/envs` | 环境管理 | 环境 CRUD，应用选择器 |
| `/features` | 特性管理 | Feature CRUD，应用+环境选择器，规则抽屉 |
| `/rules` | 规则管理 | 规则 CRUD，条件编辑器 |
| `/query` | 特性查询 | 客户端视角求值，过滤器模式 |
| `/audit` | 操作审计 | 审计日志，分页+类型过滤 |

## 文档导航

| 文档 | 说明 |
|------|------|
| [design.md](design.md) | 项目背景、架构、核心概念、后端设计 |
| [database.md](database.md) | 6 张表结构、ER 关系、规则求值流程 |
| [api.md](api.md) | 全部 21 个 API 接口 + Conditions DSL |
| [setup.md](setup.md) | 本地开发 / Docker / C++ SDK 构建 |
