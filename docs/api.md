# FlagForge API Reference

Base URL: `http://localhost:8080`

---

## 客户端接口

### GET /api/v1/features

根据应用/环境/用户上下文，求值所有 feature 开关状态。

**Query Parameters**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `app_key` | string | ✅ | 应用标识 |
| `env_key` | string | ✅ | 环境标识（dev / staging / prod / canary） |
| `user_id` | string | | 用户 ID（灰度/白名单需要） |
| `version` | string | | 客户端版本号，如 `2.1.0` |
| `platform` | string | | 平台标识，如 `ios` / `android` / `windows` |
| `attr_*` | string | | 扩展属性，前缀 `attr_` 自动解析，如 `attr_region=cn` |

**请求示例**

```
GET /api/v1/features?app_key=my_game&env_key=prod&user_id=alice&version=2.1.0&platform=ios&attr_region=cn
```

**响应 200**

```json
{
  "dark_mode": {
    "enabled": true,
    "value": ""
  },
  "new_ui": {
    "enabled": false
  },
  "welcome_text": {
    "enabled": true,
    "value": "你好世界"
  }
}
```

**错误响应**

| 状态码 | 说明 |
|--------|------|
| 400 | 缺少 `app_key` 或 `env_key` |
| 500 | 服务器内部错误 |

---

## 管理接口

### App（应用）

#### GET /admin/apps

列出所有应用。

**响应 200**

```json
[
  {
    "id": 1,
    "app_key": "my_game",
    "name": "我的游戏",
    "description": "...",
    "created_at": "2026-04-10T10:00:00Z",
    "updated_at": "2026-04-10T10:00:00Z"
  }
]
```

#### POST /admin/app

创建应用。

**请求体**

```json
{
  "app_key": "my_game",
  "name": "我的游戏",
  "description": "一款休闲游戏"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `app_key` | string | ✅ | 应用唯一标识（≤50 字符） |
| `name` | string | ✅ | 显示名称（≤100 字符） |
| `description` | string | | 描述（≤500 字符） |

**响应 201** — 返回创建后的完整对象（含 `id`）

---

### Environment（环境）

#### GET /admin/apps/:app_id/envs

列出某应用的所有环境。

**路径参数**

| 参数 | 说明 |
|------|------|
| `app_id` | 应用 ID |

**响应 200**

```json
[
  {
    "id": 1,
    "app_id": 1,
    "env_key": "dev",
    "name": "开发环境",
    "sort_order": 0,
    "is_production": false
  },
  {
    "id": 2,
    "app_id": 1,
    "env_key": "prod",
    "name": "生产环境",
    "sort_order": 10,
    "is_production": true
  }
]
```

#### POST /admin/apps/:app_id/env

创建环境。

**路径参数**

| 参数 | 说明 |
|------|------|
| `app_id` | 应用 ID |

**请求体**

```json
{
  "env_key": "prod",
  "name": "生产环境",
  "sort_order": 10,
  "is_production": true
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `env_key` | string | ✅ | 环境标识（≤30 字符），同一 app 内唯一 |
| `name` | string | | 显示名称 |
| `sort_order` | int | | 排序权重，默认 0 |
| `is_production` | bool | | 是否生产环境，默认 false |

**响应 201** — 返回创建后的完整对象（含 `id`，`app_id` 从路径自动填充）

---

### Feature（功能开关）

#### GET /admin/features

列出 feature，可按应用过滤。

**Query Parameters**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `app_id` | uint | | 按应用过滤，不传则返回全部 |

**响应 200**

```json
[
  {
    "id": 1,
    "app_id": 1,
    "key_name": "dark_mode",
    "value_type": "boolean",
    "description": "暗黑模式开关",
    "targeting_rules": [
      {
        "id": 1,
        "feature_id": 1,
        "env_id": 1,
        "name": "VIP 用户",
        "priority": 0,
        "active": true,
        "conditions": "[{\"type\":\"user_list\",\"value\":[\"alice\",\"bob\"]}]",
        "enabled": true,
        "value": ""
      },
      {
        "id": 2,
        "feature_id": 1,
        "env_id": 1,
        "name": "基线：默认关闭",
        "priority": 100,
        "active": true,
        "conditions": "[]",
        "enabled": false,
        "value": ""
      }
    ]
  }
]
```

#### POST /admin/feature

创建 feature。

**请求体**

```json
{
  "app_id": 1,
  "key_name": "dark_mode",
  "value_type": "boolean",
  "description": "暗黑模式开关"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `app_id` | uint | ✅ | 所属应用 ID |
| `key_name` | string | ✅ | feature 标识（≤100 字符），同一 app 内唯一 |
| `value_type` | string | | `boolean` / `string` / `json`，默认 `boolean` |
| `description` | string | | 描述 |

**响应 201** — 返回创建后的完整对象

#### PUT /admin/feature/:id

更新 feature。

**路径参数**: `id` — feature ID

**请求体** — 同 POST，字段可选（部分更新）

**响应 200** — 返回更新后的完整对象  
**响应 404** — feature 不存在

#### DELETE /admin/feature/:id

删除 feature（级联删除其所有 targeting rules）。

**响应 200**

```json
{ "message": "deleted" }
```

---

### Targeting Rule（定向规则）

#### POST /admin/rule

创建定向规则。

**请求体**

```json
{
  "feature_id": 1,
  "env_id": 1,
  "name": "iOS VIP 用户灰度 30%",
  "priority": 0,
  "active": true,
  "conditions": "{\"op\":\"and\",\"items\":[{\"type\":\"user_list\",\"value\":[\"alice\",\"bob\"]},{\"op\":\"or\",\"items\":[{\"type\":\"version\",\"value\":\">=2.0\"},{\"type\":\"platform\",\"value\":\"ios\"}]}]}",
  "enabled": true,
  "value": ""
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `feature_id` | uint | ✅ | 所属 feature ID |
| `env_id` | uint | ✅ | 所属环境 ID |
| `name` | string | | 规则名称 |
| `priority` | int | | 优先级（越小越先匹配），默认 0 |
| `active` | bool | | 是否启用，默认 true |
| `conditions` | string | | 条件树 JSON（见下方 DSL），默认 `[]`（match all） |
| `enabled` | bool | | 命中后 feature 是否开启 |
| `value` | string | | 命中后返回的值 |

**响应 201** — 返回创建后的完整对象

#### PUT /admin/rule/:id

更新定向规则。

**路径参数**: `id` — rule ID

**请求体** — 同 POST

**响应 200** — 返回更新后的完整对象

#### DELETE /admin/rule/:id

删除定向规则。

**响应 200**

```json
{ "message": "deleted" }
```

---

## Conditions DSL

`conditions` 字段是 JSON 字符串，支持三种格式：

### 1. 空数组 — match all（基线规则）

```json
[]
```

### 2. 裸数组 — 隐式 AND

```json
[
  {"type": "user_list", "value": ["alice", "bob"]},
  {"type": "version", "value": ">=2.0.0"}
]
```

等价于 `user ∈ whitelist AND version >= 2.0.0`

### 3. 条件树 — 显式 AND / OR 嵌套

```json
{
  "op": "and",
  "items": [
    {"type": "user_list", "value": ["alice"]},
    {
      "op": "or",
      "items": [
        {"type": "version", "value": ">=2.0"},
        {"type": "platform", "value": "ios"}
      ]
    }
  ]
}
```

等价于 `user = alice AND (version >= 2.0 OR platform = ios)`

### 支持的条件类型

| type | value 格式 | 说明 |
|------|-----------|------|
| `user_list` | `["alice", "bob"]` | 白名单，用户 ID 精确匹配 |
| `percentage` | `30` | 灰度 30%，基于 `fnv(featureKey + userID)` |
| `percentage` | `{"pct": 30, "key": "exp_abc"}` | 自定义 rollout key（跨 feature 共享同一批用户） |
| `version` | `">=2.0.0"` | 版本约束，支持 `>` `>=` `<` `<=` `=` |
| `platform` | `"ios"` | 平台精确匹配（不区分大小写） |
| `attr` | `{"key": "region", "value": "cn"}` | 扩展属性匹配（不区分大小写） |

### 求值逻辑

1. 按 `priority ASC, id ASC` 顺序逐条规则匹配
2. 首条命中的规则终止求值，返回该规则的 `enabled` 和 `value`
3. 无规则命中 → `enabled: false`
4. `active = false` 的规则跳过
5. 仅加载指定 `env_id` 的规则

---

## 错误格式

所有错误响应统一格式：

```json
{
  "error": "error message here"
}
```

| 状态码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
