# FlagForge

Feature Flag 平台 — 动态功能开关、灰度发布、白名单控制、用户级覆盖。

## 特性

- **多应用/多环境** — App → Environment → Feature 三级隔离
- **递归条件引擎** — 支持 AND/OR 嵌套的 Conditions DSL
- **6 种条件类型** — user_list / percentage / version / platform / attr / match-all
- **用户级覆盖** — 用户可自行开关 feature，优先级最高
- **灰度发布** — FNV32a hash 保证同一用户在同一 feature 下结果一致
- **版本定向** — 支持 `>=` `<=` `>` `<` `=` 全运算符，含 pre-release
- **客户端 SDK** — C++ / C 双语言 SDK，本地缓存 + 后台轮询 + 回调通知

## 技术栈

| 组件 | 技术 |
|------|------|
| 后端 | Go 1.24 + Gin + GORM + SQLite |
| Web 管理后台 | React 18 + Vite 5 + Ant Design 5 |
| C++ SDK | C++17 + CMake + cpp-httplib + nlohmann/json |
| C SDK | C11，基于 C++ SDK 的 extern "C" 封装 |
| 部署 | Docker Compose + nginx 反向代理 |

## 快速开始

```bash
# 启动后端
cd backend && go run .

# 启动前端（另开终端）
cd web && npm install && npm run dev
```

## 项目状态

- 后端：**已完成** — 21 个 API 接口，6 张表，审计日志全覆盖
- Web 管理后台：**已完成** — 6 个管理页面（应用/环境/特性/规则/查询/审计）
- C++ SDK：**已完成** — pimpl 模式，后台轮询，XOR 缓存混淆，回调通知
- C SDK：**已完成** — 纯 C11 API，handle 模式，线程安全

## 文档

- [项目文档](docs/README.md) — 项目结构与快速启动
- [设计文档](docs/design.md) — 架构设计与核心概念
- [数据库设计](docs/database.md) — 表结构与规则求值流程
- [API 参考](docs/api.md) — 全部 21 个接口文档 + Conditions DSL
- [环境搭建](docs/setup.md) — 本地开发与部署指南
