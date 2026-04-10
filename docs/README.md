# FlagForge - Feature Flag Platform

## 项目结构

```
FlagForge/
├── backend/          # Go 配置服务 (Gin + GORM + SQLite)
│   ├── api/          # HTTP 接口（15 个路由）
│   ├── service/      # 业务逻辑 + 递归条件引擎
│   ├── model/        # GORM 数据模型（6 张表）
│   ├── storage/      # 数据库操作
│   └── cache/        # 缓存（预留）
├── web/              # React 管理后台 (Vite + Ant Design)（开发中）
├── sdk/
│   └── cpp/          # C++ 客户端 SDK（开发中）
├── deploy/           # Docker Compose + SQL（MySQL 生产部署）
├── scripts/          # 测试脚本
├── example/          # 示例代码
└── docs/             # 文档
    ├── design.md     # 架构设计
    ├── database.md   # 数据库设计
    ├── api.md        # API 参考
    └── setup.md      # 环境搭建
```

## 快速开始

```bash
# 自动启动后端 + 运行 100 个测试
pip install requests
python scripts/test_api.py

# 带 Go 代码覆盖率
python scripts/test_api.py --cover

# 仅启动后端
cd backend && go run .
```

## 服务端口

| 服务     | 端口   | 状态 |
| -------- | ------ | ---- |
| Backend  | :8080  | ✅ 可用 |
| Web      | :3000  | 开发中 |

## 文档导航

| 文档 | 说明 |
|------|------|
| [design.md](design.md) | 项目背景、架构、核心概念、后端设计 |
| [database.md](database.md) | 6 张表结构、ER 关系、规则求值流程 |
| [api.md](api.md) | 全部 15 个 API 接口 + Conditions DSL |
| [setup.md](setup.md) | 本地开发 / Docker / C++ SDK 构建 |
