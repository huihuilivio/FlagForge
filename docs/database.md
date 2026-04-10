# FlagForge 数据库设计文档

## ER 关系图

```
apps 1──N environments
apps 1──N features
features 1──N feature_targeting_rules ──N→1 environments
apps + environments + features + users ──→ user_feature_overrides
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

统一承载所有规则逻辑：基线、白名单、灰度、版本定向、平台定向、属性匹配。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uint | PK, AUTO_INCREMENT | |
| feature_id | uint | FK → features(id), NOT NULL | 所属 feature |
| env_id | uint | FK → environments(id), NOT NULL | 所属环境 |
| name | varchar(100) | | 规则名称，如 "VIP用户强制开启" |
| priority | int | NOT NULL, DEFAULT 0 | 数值越小优先级越高 |
| active | bool | NOT NULL, DEFAULT true | 规则开关，false=跳过不参与求值 |
| conditions | text | NOT NULL, DEFAULT '[]' | 条件树 JSON（Conditions DSL，支持 AND/OR 嵌套） |
| enabled | bool | DEFAULT false | 命中后返回的开关值 |
| value | text | | 命中后返回的值（string/json 类型使用） |
| created_at | datetime | NOT NULL | |
| updated_at | datetime | NOT NULL | |

**索引**: `INDEX idx_targeting_fe(feature_id, env_id, priority)` — 非唯一索引，允许同优先级（便于插入/排序）。

**注意**: `conditions` 是 JSON 字符串，不可索引查询。DB 层仅按 `env_id + active` 过滤，条件匹配在应用层内存中完成。

#### conditions 格式

支持三种格式（详见 [API 文档 — Conditions DSL](api.md#conditions-dsl)）：

| 格式 | 含义 | 示例 |
|------|------|------|
| `[]` 或空 | match all（基线规则） | `[]` |
| 裸数组 | 隐式 AND | `[{"type":"user_list","value":["alice"]}]` |
| 条件树 | 显式 AND/OR 嵌套 | `{"op":"and","items":[...]}` |

#### 支持的条件类型

| type | value 格式 | 匹配逻辑 |
|------|-----------|---------|
| `user_list` | `["alice","bob"]` | user_id 在列表中 |
| `percentage` | `30` 或 `{"pct":30,"key":"exp_abc"}` | `fnv32a(featureKey + \0 + userID) % 100 < pct` |
| `version` | `">=2.0.0"` | 客户端版本满足条件（支持 `>` `>=` `<` `<=` `=`） |
| `platform` | `"ios"` | 平台精确匹配（不区分大小写） |
| `attr` | `{"key":"region","value":"cn"}` | 扩展属性匹配（不区分大小写） |

#### 字段区分

| 字段 | 含义 |
|------|------|
| `active` | 规则本身是否参与求值（规则开关，可快速关闭不删数据） |
| `enabled` | 命中后返回给客户端的 feature 开关值 |

---

### user_feature_overrides — 用户级覆盖表

用户可自行设置 feature 开关，优先级高于所有定向规则。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uint | PK, AUTO_INCREMENT | |
| app_id | uint | FK → apps(id), NOT NULL | 所属应用 |
| env_id | uint | FK → environments(id), NOT NULL | 所属环境 |
| feature_id | uint | FK → features(id), NOT NULL | 所属 feature |
| user_id | varchar(100) | NOT NULL | 用户标识 |
| enabled | bool | NOT NULL, DEFAULT false | 开关值 |
| value | text | | 自定义值 |
| created_at | datetime | NOT NULL | |
| updated_at | datetime | NOT NULL | |

**唯一约束**: `UNIQUE(app_id, env_id, feature_id, user_id)` — 同一用户在同一应用/环境/feature 下只能有一条覆盖。

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
  GET /api/v1/features?app_key=my_game&env_key=prod&user_id=alice&version=2.0.0&platform=ios

服务端求值:
  1. 通过 app_key 查到 app_id
  2. 通过 env_key 查到 env_id
  3. 查询该 app 下所有 features（预加载指定 env 的 active rules）
  4. 加载用户级覆盖 (user_feature_overrides)
  5. 对每个 feature:

     // Step 1: 检查用户覆盖（优先级最高）
     SELECT * FROM user_feature_overrides
     WHERE app_id=? AND env_id=? AND feature_id=? AND user_id=?
     → 命中则直接返回 {enabled, value} ⛔ 终止

     // Step 2: 按优先级遍历定向规则
     SELECT * FROM feature_targeting_rules
     WHERE feature_id = ? AND env_id = ? AND active = 1
     ORDER BY priority ASC, id ASC

     逐条解析 conditions JSON → 递归求值条件树：
     ┌─ priority=0:   conditions=[{user_list:["bob"]}]  → 不匹配，继续
     ├─ priority=10:  conditions=[{user_list:["alice"]}] → 命中！返回 {enabled, value} ⛔ 终止
     ├─ priority=20:  conditions=[{version:">=2.0"}]     → (跳过)
     ├─ priority=30:  conditions=[{percentage:30}]        → (跳过)
     └─ priority=999: conditions=[]                       → match all (基线)

  6. 无任何规则命中 → feature 返回默认值 (enabled: false)
```

---

## 数据隔离

- **App 级隔离**: 不同 app 的 feature key 可以同名，通过 `UNIQUE(app_id, key_name)` 隔离
- **环境级隔离**: 同一 feature 在不同环境有独立规则，通过 `env_id` FK 隔离
- **用户级隔离**: user_id 在外部系统管理，targeting_rules 通过 `feature_id`（隐含 app）区分

---

## SQL 脚本

- 本地开发（SQLite）: `deploy/init.sql`
- 生产环境（MySQL）: `deploy/init-mysql.sql`
- Go 代码使用 GORM `AutoMigrate` 自动建表，SQL 脚本作为参考
