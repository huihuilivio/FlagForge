# FlagForge 数据库设计文档

## ER 关系图

```
apps 1──N environments
apps 1──N features
features 1──N feature_targeting_rules ──N→1 environments
audit_logs ──→ apps (nullable)
audit_logs ──→ features (nullable)
audit_logs ──→ environments (nullable)
```

---

## 表结构

### apps — 应用表

每个应用（产品）是一个独立的 feature flag 管理单元。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uint | PK, AUTO_INCREMENT | |
| app_key | varchar(50) | UNIQUE, NOT NULL | 应用唯一标识，如 `my_game` |
| name | varchar(100) | NOT NULL | 显示名称 |
| description | varchar(500) | | 应用描述 |
| created_at | datetime | NOT NULL | |
| updated_at | datetime | NOT NULL | |

---

### environments — 环境表

per-app 级别，每个应用独立定义自己的环境集。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uint | PK, AUTO_INCREMENT | |
| app_id | uint | FK → apps(id), NOT NULL | 所属应用 |
| env_key | varchar(30) | NOT NULL | 环境标识：`dev` / `staging` / `prod` / `canary` |
| name | varchar(100) | | 显示名称 |
| sort_order | int | DEFAULT 0 | 排序 |
| is_production | bool | DEFAULT false | 是否为生产环境（用于安全提示） |
| created_at | datetime | NOT NULL | |
| updated_at | datetime | NOT NULL | |

**唯一约束**: `UNIQUE(app_id, env_key)`

扩展新环境只需插入一行，FK 保证其他表不会引用非法环境。

---

### features — 功能开关主表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uint | PK, AUTO_INCREMENT | |
| app_id | uint | FK → apps(id), NOT NULL | 所属应用 |
| key_name | varchar(100) | NOT NULL | feature 标识，如 `new_ui` |
| value_type | varchar(20) | NOT NULL, DEFAULT `boolean` | `boolean` / `string` / `json` |
| description | varchar(500) | | 功能描述 |
| created_at | datetime | NOT NULL | |
| updated_at | datetime | NOT NULL | |

**唯一约束**: `UNIQUE(app_id, key_name)` — 同一 app 下 key 不重复，不同 app 可以有同名 key。

**value_type 说明**:

| value_type | 客户端调用 | 返回示例 |
|-----------|-----------|---------|
| boolean | `isEnabled("new_ui")` | `true` / `false` |
| string | `getValue("theme_color")` | `"blue"` |
| json | `getValue("experiment_config")` | `{"variant":"A"}` |

---

### feature_targeting_rules — 定向规则表

统一承载所有规则逻辑：基线、白名单、用户覆盖、灰度、版本定向。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uint | PK, AUTO_INCREMENT | |
| feature_id | uint | FK → features(id), NOT NULL | 所属 feature |
| env_id | uint | FK → environments(id), NOT NULL | 所属环境 |
| name | varchar(100) | | 规则名称，如 "VIP用户强制开启" |
| priority | int | NOT NULL, DEFAULT 0 | 数值越小优先级越高 |
| active | bool | NOT NULL, DEFAULT true | 规则开关，false=跳过不参与求值 |
| match_type | varchar(30) | NOT NULL | 匹配类型 |
| match_value | text | | 匹配参数（JSON 格式） |
| enabled | bool | DEFAULT false | 命中后返回的开关值 |
| value | varchar(500) | | 命中后返回的值（string/json 类型使用） |
| created_at | datetime | NOT NULL | |
| updated_at | datetime | NOT NULL | |

**唯一约束**: `UNIQUE(feature_id, env_id, priority)` — 同一 feature 同一环境下优先级不可重复。

#### match_type 取值

| match_type | match_value 格式 | 匹配逻辑 |
|-----------|-----------------|---------|
| `user_list` | `["alice","bob"]` | user_id 在列表中 |
| `percentage` | `30` | `hash(user_id) % 100 < 30` |
| `version` | `">=2.0.0"` | 客户端版本满足条件 |
| `all` | `null` | 无条件命中（基线规则） |

#### 字段区分

| 字段 | 含义 |
|------|------|
| `active` | 规则本身是否参与求值（规则开关，可快速关闭不删数据） |
| `enabled` | 命中后返回给客户端的 feature 开关值 |

---

### audit_logs — 操作审计日志

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uint | PK, AUTO_INCREMENT | |
| app_id | uint | nullable, FK → apps(id) ON DELETE SET NULL | 快速过滤应用 |
| feature_id | uint | nullable, FK → features(id) ON DELETE SET NULL | 快速过滤 feature |
| env_id | uint | nullable, FK → environments(id) ON DELETE SET NULL | 快速过滤环境 |
| operator | varchar(100) | | 操作者 |
| action | varchar(50) | NOT NULL | `create` / `update` / `delete` / `toggle` |
| target_type | varchar(50) | NOT NULL | `feature` / `targeting_rule` |
| target_id | uint | NOT NULL | 操作对象 ID |
| detail | json/text | | 变更详情 |
| created_at | datetime | NOT NULL | |

**索引**: `app_id`、`feature_id`、`env_id`、`(target_type, target_id)`、`created_at`

nullable 设计：被删除的 app/feature/env 不会导致审计记录丢失，仅对应字段变为 NULL。

---

## 规则求值流程

```
客户端请求:
  GET /api/v1/features?app=my_game&user_id=alice&env=prod&version=1.2.0

服务端求值:
  1. 通过 app_key 查到 app_id
  2. 通过 env_key 查到 env_id
  3. 查询该 app 下所有 features
  4. 对每个 feature:

     SELECT * FROM feature_targeting_rules
     WHERE feature_id = ? AND env_id = ? AND active = 1
     ORDER BY priority ASC

     逐条匹配:
     ┌─ priority=0:   user_list ["bob"]     → 不匹配，继续
     ├─ priority=10:  user_list ["alice"]   → 命中！返回 {enabled, value} ⛔ 终止
     ├─ priority=20:  version ">=2.0.0"     → (跳过)
     ├─ priority=30:  percentage 30         → (跳过)
     └─ priority=999: all null              → (跳过)

  5. 无任何规则命中 → feature 返回默认值 (false / "")
```

---

## 数据隔离

- **App 级隔离**: 不同 app 的 feature key 可以同名，通过 `UNIQUE(app_id, key_name)` 隔离
- **环境级隔离**: 同一 feature 在不同环境有独立规则，通过 `env_id` FK 隔离
- **用户级隔离**: user_id 在外部系统管理，targeting_rules 通过 `feature_id`（隐含 app）区分，不同 app 的同名用户互不影响

---

## SQL 脚本

- 本地开发（SQLite）: `deploy/init.sql`
- 生产环境（MySQL）: `deploy/init-mysql.sql`
- Go 代码使用 GORM `AutoMigrate` 自动建表，SQL 脚本作为参考
