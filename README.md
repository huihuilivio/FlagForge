# FlagForge

Feature Flag 平台 — 动态功能开关、灰度发布、白名单控制、用户级覆盖。

## 特性

- **多应用/多环境** — App → Environment → Feature 三级隔离
- **递归条件引擎** — 支持 AND/OR 嵌套的 Conditions DSL
- **6 种条件类型** — user_list / percentage / version / platform / attr / match-all
- **用户级覆盖** — 用户可自行开关 feature，优先级最高
- **灰度发布** — FNV32a hash 保证同一用户在同一 feature 下结果一致
- **版本定向** — 支持 `>=` `<=` `>` `<` `=` 全运算符
- **优雅关闭** — 支持代码覆盖率数据刷写

## 技术栈

| 组件 | 技术 |
|------|------|
| 后端 | Go 1.24 + Gin + GORM |
| 数据库 | SQLite（本地开发）/ MySQL（生产） |
| Web 管理后台 | React + Vite + Ant Design（开发中） |
| C++ SDK | CMake + C++17（开发中） |

## 快速开始

```bash
# 运行测试（自动启动后端、清理 DB、100 个测试用例）
pip install requests
python scripts/test_api.py

# 带 Go 代码覆盖率
python scripts/test_api.py --cover
```

## 项目状态

- 后端：**已完成** — 15 个 API 接口，100 个测试用例，88.8% 代码覆盖率
- Web 管理后台：开发中
- C++ SDK：开发中

## 文档

- [项目文档](docs/README.md) — 项目结构与快速启动
- [设计文档](docs/design.md) — 架构设计与核心概念
- [数据库设计](docs/database.md) — 表结构与规则求值流程
- [API 参考](docs/api.md) — 全部 15 个接口文档 + Conditions DSL
- [环境搭建](docs/setup.md) — 本地开发与部署指南
