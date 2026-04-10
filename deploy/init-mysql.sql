-- FlagForge MySQL Schema（生产环境）

CREATE DATABASE IF NOT EXISTS flagforge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE flagforge;

-- 应用表
CREATE TABLE IF NOT EXISTS apps (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    app_key VARCHAR(50) NOT NULL COMMENT '应用唯一标识',
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500) DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX uk_app_key (app_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 环境表（per-app，可扩展）
CREATE TABLE IF NOT EXISTS environments (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    app_id BIGINT UNSIGNED NOT NULL,
    env_key VARCHAR(30) NOT NULL COMMENT '环境标识：dev / staging / prod / canary',
    name VARCHAR(100) DEFAULT '' COMMENT '显示名称',
    sort_order INT NOT NULL DEFAULT 0,
    is_production BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否为生产环境',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX uk_app_env (app_id, env_key),
    CONSTRAINT fk_env_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 功能开关主表
CREATE TABLE IF NOT EXISTS features (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    app_id BIGINT UNSIGNED NOT NULL,
    key_name VARCHAR(100) NOT NULL,
    value_type VARCHAR(20) NOT NULL DEFAULT 'boolean' COMMENT 'boolean / string / json',
    description VARCHAR(500) DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX uk_app_key (app_id, key_name),
    CONSTRAINT fk_feature_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 定向规则表（多条件组合 AND/OR 求值）
-- DB 职责：按 feature_id + env_id 存取，按 priority 排序
-- 规则匹配在应用层完成，conditions 列不参与 SQL 查询
CREATE TABLE IF NOT EXISTS feature_targeting_rules (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    feature_id BIGINT UNSIGNED NOT NULL,
    env_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(100) DEFAULT '' COMMENT '规则名称',
    priority INT NOT NULL DEFAULT 0 COMMENT '数值越小优先级越高',
    active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '规则开关，FALSE=求值时跳过',
    conditions JSON NOT NULL DEFAULT ('[]') COMMENT '条件树，支持 and/or 嵌套；裸数组=隐式AND；[]=match-all；例: {"op":"and","items":[{"type":"user_list","value":["alice"]},{"op":"or","items":[{"type":"version","value":">=2.0"},{"type":"platform","value":"ios"}]}]}',
    enabled BOOLEAN NOT NULL DEFAULT FALSE COMMENT '命中后是否开启',
    value TEXT DEFAULT '' COMMENT '命中后的值（boolean/string/json 均存为文本）',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_targeting_feature FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
    CONSTRAINT fk_targeting_env FOREIGN KEY (env_id) REFERENCES environments(id) ON DELETE CASCADE,
    INDEX idx_targeting_fe (feature_id, env_id, priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 用户级 feature 覆盖（优先级最高：用户覆盖 > 定向规则 > 基线规则）
CREATE TABLE IF NOT EXISTS user_feature_overrides (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    app_id BIGINT UNSIGNED NOT NULL,
    env_id BIGINT UNSIGNED NOT NULL,
    feature_id BIGINT UNSIGNED NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    value TEXT DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX uk_user_override (app_id, env_id, feature_id, user_id),
    CONSTRAINT fk_override_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
    CONSTRAINT fk_override_env FOREIGN KEY (env_id) REFERENCES environments(id) ON DELETE CASCADE,
    CONSTRAINT fk_override_feature FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 操作审计日志
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    app_id BIGINT UNSIGNED DEFAULT NULL COMMENT '关联应用',
    feature_id BIGINT UNSIGNED DEFAULT NULL COMMENT '关联 feature',
    env_id BIGINT UNSIGNED DEFAULT NULL COMMENT '关联环境',
    operator VARCHAR(100) NOT NULL DEFAULT '',
    action VARCHAR(50) NOT NULL COMMENT 'create / update / delete / toggle',
    target_type VARCHAR(50) NOT NULL COMMENT 'feature / targeting_rule',
    target_id BIGINT UNSIGNED NOT NULL,
    detail JSON DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_app (app_id),
    INDEX idx_audit_feature (feature_id),
    INDEX idx_audit_env (env_id),
    INDEX idx_audit_target (target_type, target_id),
    INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
