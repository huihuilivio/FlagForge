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

-- 定向规则表（统一基线、白名单、用户覆盖、灰度、版本定向等）
-- 求值：按 priority ASC 逐条匹配，首条命中即终止并返回结果
-- match_type=all 作为最低优先级的基线规则
CREATE TABLE IF NOT EXISTS feature_targeting_rules (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    feature_id BIGINT UNSIGNED NOT NULL,
    env_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(100) DEFAULT '' COMMENT '规则名称',
    priority INT NOT NULL DEFAULT 0 COMMENT '数值越小优先级越高',
    active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '规则开关，FALSE=求值时跳过',
    match_type VARCHAR(30) NOT NULL COMMENT 'user_list / percentage / version / all',
    match_value TEXT DEFAULT NULL COMMENT 'JSON: ["alice","bob"] / 30 / ">=2.0.0"',
    enabled BOOLEAN NOT NULL DEFAULT FALSE COMMENT '命中后是否开启',
    value VARCHAR(500) DEFAULT '' COMMENT '命中后的值',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX uk_targeting_priority (feature_id, env_id, priority),
    CONSTRAINT fk_targeting_feature FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
    CONSTRAINT fk_targeting_env FOREIGN KEY (env_id) REFERENCES environments(id) ON DELETE CASCADE
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
