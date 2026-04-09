# Feature Flag Platform 设计文档

## 1. 项目背景

在软件持续迭代过程中，需要一种机制来：

* 动态控制功能开关（无需发版）
* 支持灰度发布（部分用户生效）
* 快速回滚功能（降低风险）
* 支持实验与A/B测试

本项目目标是构建一套完整的 Feature Flag 平台，包含：

* 后端配置中心
* Web 管理后台
* C++ 客户端 SDK

---

## 2. 系统目标

### 2.1 功能目标

* Feature 开关控制（on/off）
* 灰度发布（按用户 / 百分比）
* 白名单控制
* 动态更新（热更新）
* 多环境支持（dev / test / prod）

### 2.2 非功能目标

* 高可用（服务挂掉仍可运行）
* 低延迟（本地判断）
* 易扩展（支持未来 A/B 测试）
* 可观测（日志 + 统计）

---

## 3. 系统架构

```
                ┌──────────────────────┐
                │   Web Admin Console  │
                └─────────┬────────────┘
                          │ REST API
                          ▼
                ┌──────────────────────┐
                │ Feature Config Server│
                └─────────┬────────────┘
                          │ HTTP 拉取
        ┌─────────────────┴─────────────────┐
        ▼                                   ▼
┌──────────────┐                    ┌──────────────┐
│  PC Client   │                    │  Server App  │
│ (C++ SDK)    │                    │ Feature SDK  │
└──────────────┘                    └──────────────┘
```

---

## 4. 仓库结构

```
feature-flag-platform/
├── backend/          # 配置服务
├── web/              # 管理后台
├── sdk/
│   └── cpp/          # C++ SDK
├── docs/             # 文档
├── deploy/           # 部署配置
└── scripts/          # 启动脚本
```

---

## 5. 核心概念

### 5.1 Feature

```json
{
  "key": "new_ui",
  "enabled": true
}
```

---

### 5.2 Feature Rule

```json
{
  "key": "new_ui",
  "enabled": true,
  "percentage": 30,
  "whitelist": ["user1", "user2"],
  "min_version": "1.0.0"
}
```

---

## 6. 后端设计

### 6.1 技术选型

* 语言：Go
* 框架：Gin
* 数据库：MySQL
* 缓存：Redis（可选）

---

### 6.2 模块划分

```
backend/
├── api/        # HTTP接口
├── service/    # 业务逻辑
├── model/      # 数据结构
├── storage/    # DB操作
└── cache/      # 缓存
```

---

### 6.3 数据库设计

#### features 表

```sql
CREATE TABLE features (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    key_name VARCHAR(100) NOT NULL,
    value_type VARCHAR(20) NOT NULL DEFAULT 'boolean' COMMENT 'boolean / string / json',
    description VARCHAR(500) DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### feature_rules 表（多环境规则）

```sql
CREATE TABLE feature_rules (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    feature_id BIGINT UNSIGNED NOT NULL,
    env VARCHAR(20) NOT NULL DEFAULT 'prod',
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    value VARCHAR(500) DEFAULT '',
    percentage TINYINT UNSIGNED NOT NULL DEFAULT 100,
    min_version VARCHAR(20) DEFAULT ''
);
```

---

### 6.4 API 设计

#### 客户端接口

```
GET /api/v1/features
```

请求参数：

| 参数      | 说明    |
| ------- | ----- |
| app     | 应用名   |
| version | 客户端版本 |
| user_id | 用户ID  |

返回：

```json
{
  "features": {
    "new_ui": true,
    "chat_ai": false
  }
}
```

---

#### 管理接口

```
GET    /admin/features
POST   /admin/feature
PUT    /admin/feature/:id
DELETE /admin/feature/:id
```

---

### 6.5 灰度逻辑

执行顺序：

1. 判断 enabled
2. 判断版本
3. 判断白名单
4. 判断百分比

```go
func IsEnabled(feature Feature, userId string) bool {
    if !feature.Enabled {
        return false
    }

    if inWhitelist(userId) {
        return true
    }

    hash := hash(userId) % 100
    return hash < feature.Percentage
}
```

---

## 7. Web 管理后台

### 7.1 技术选型

* React + Vite
* Ant Design（UI）

---

### 7.2 页面设计

#### Feature 列表页

* Feature Key
* 开关（Switch）
* 灰度比例（Slider）
* 白名单（输入框）
* 操作（编辑 / 删除）

---

### 7.3 功能点

* 实时开关控制
* 灰度调整
* 发布按钮（触发更新）

---

## 8. C++ SDK 设计

### 8.1 目录结构

```
sdk/cpp/
├── include/
├── src/
├── CMakeLists.txt
```

---

### 8.2 核心类

```cpp
class FeatureManager {
public:
    static FeatureManager& instance();

    void init(const std::string& url);

    bool isEnabled(const std::string& key);
    std::string getValue(const std::string& key);

private:
    void loadLocalCache();
    void fetchRemote();

private:
    std::unordered_map<std::string, bool> features_;
};
```

---

### 8.3 初始化流程

```
启动
  ↓
加载本地缓存
  ↓
异步拉取远程配置
  ↓
更新内存 + 写缓存
```

---

### 8.4 本地缓存

文件：

```
feature_cache.json
```

作用：

* 服务不可用时兜底
* 加快启动速度

---

### 8.5 使用方式

```cpp
if (FeatureManager::instance().isEnabled("new_ui")) {
    // 新逻辑
}

std::string theme = FeatureManager::instance().getValue("theme_color");
```

---

## 9. 配置更新机制

### 9.1 轮询（默认）

* 每 10 秒拉取一次

---

### 9.2 推送（进阶）

* WebSocket
* SSE

---

## 10. 容错设计

* 拉取失败 → 使用缓存
* JSON解析失败 → 忽略
* 服务不可用 → 不影响业务

---

## 11. 部署方案

### 11.1 Docker Compose

```yaml
version: '3'
services:
  backend:
    build: ./backend
    ports:
      - "8080:8080"

  web:
    build: ./web
    ports:
      - "3000:3000"

  mysql:
    image: mysql:8
```

---

## 12. 安全设计

* 管理接口鉴权（JWT）
* 操作日志记录
* 权限控制（RBAC）

---

## 13. 日志与监控

建议记录：

* Feature命中日志
* 灰度命中率
* API调用情况

---

## 14. 扩展方向

### 14.1 A/B 测试

```json
{
  "homepage": "A"
}
```

---

### 14.2 实验平台

* 曝光统计
* 转化率分析

---

### 14.3 AI 联动

* 自动调节 Feature
