# FlagForge - Feature Flag Platform

## 项目结构

```
FlagForge/
├── backend/          # Go 配置服务 (Gin + MySQL)
├── web/              # React 管理后台 (Vite + Ant Design)
├── sdk/
│   └── cpp/          # C++ 客户端 SDK
├── deploy/           # Docker Compose 部署配置
├── scripts/          # 启动脚本
├── docs/             # 文档
└── design.md         # 设计文档
```

## 快速开始

```bash
# 使用 Docker Compose 启动
./scripts/start-dev.sh
```

## 服务端口

| 服务     | 端口   |
| -------- | ------ |
| Backend  | :8080  |
| Web      | :3000  |
| MySQL    | :3306  |
