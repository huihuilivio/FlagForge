CREATE DATABASE IF NOT EXISTS flagforge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE flagforge;

-- 功能开关主表
CREATE TABLE IF NOT EXISTS features (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    key_name VARCHAR(100) NOT NULL,
    value_type VARCHAR(20) NOT NULL DEFAULT 'boolean' COMMENT 'boolean / string / json',
    description VARCHAR(500) DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX uk_key_name (key_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 多环境规则表（每个 feature 在不同环境下有独立配置）
CREATE TABLE IF NOT EXISTS feature_rules (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    feature_id BIGINT UNSIGNED NOT NULL,
    env VARCHAR(20) NOT NULL DEFAULT 'prod' COMMENT 'dev / test / prod',
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    value VARCHAR(500) DEFAULT '' COMMENT 'string 类型的返回值，如 blue / green',
    percentage TINYINT UNSIGNED NOT NULL DEFAULT 100 CHECK (percentage BETWEEN 0 AND 100),
    min_version VARCHAR(20) DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX uk_feature_env (feature_id, env),
    CONSTRAINT fk_rule_feature FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 白名单表（归一化，便于查询与维护）
CREATE TABLE IF NOT EXISTS feature_whitelist (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    feature_id BIGINT UNSIGNED NOT NULL,
    env VARCHAR(20) NOT NULL DEFAULT 'prod',
    user_id VARCHAR(100) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX uk_feature_env_user (feature_id, env, user_id),
    INDEX idx_user (user_id),
    CONSTRAINT fk_wl_feature FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 操作审计日志
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    operator VARCHAR(100) NOT NULL DEFAULT '',
    action VARCHAR(50) NOT NULL COMMENT 'create / update / delete / toggle',
    target_type VARCHAR(50) NOT NULL COMMENT 'feature / rule / whitelist',
    target_id BIGINT UNSIGNED NOT NULL,
    detail JSON DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_target (target_type, target_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
