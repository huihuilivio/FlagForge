-- FlagForge SQLite Schema
-- 本地开发使用 SQLite，GORM AutoMigrate 会自动建表
-- 此文件作为参考和生产环境（MySQL）的建表脚本

-- ============================================================
-- SQLite 版本（本地开发）
-- ============================================================

-- 应用表
CREATE TABLE IF NOT EXISTS apps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_key TEXT NOT NULL UNIQUE,                -- 应用唯一标识，如 my_game / my_editor
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 环境表（per-app，可扩展）
CREATE TABLE IF NOT EXISTS environments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    env_key TEXT NOT NULL,                       -- dev / staging / prod / canary ...
    name TEXT DEFAULT '',                        -- 显示名称
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_production BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (app_id, env_key)
);

-- 功能开关主表
CREATE TABLE IF NOT EXISTS features (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    key_name TEXT NOT NULL,
    value_type TEXT NOT NULL DEFAULT 'boolean',  -- boolean / string / json
    description TEXT DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (app_id, key_name)
);

-- 定向规则表（多条件组合 AND/OR 求值）
-- DB 职责：按 feature_id + env_id 存取，按 priority 排序
-- 规则匹配在应用层完成，conditions 列不参与 SQL 查询
CREATE TABLE IF NOT EXISTS feature_targeting_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feature_id INTEGER NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    env_id INTEGER NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    name TEXT DEFAULT '',                        -- 规则名称，如 "VIP用户强制开启"
    priority INTEGER NOT NULL DEFAULT 0,         -- 数值越小优先级越高
    active BOOLEAN NOT NULL DEFAULT 1,            -- 规则开关，0=跳过此规则
    conditions TEXT NOT NULL DEFAULT '[]',        -- 条件树，支持 and/or 嵌套；裸数组=隐式AND；[]=match-all
    enabled BOOLEAN NOT NULL DEFAULT 0,          -- 命中后是否开启
    value TEXT DEFAULT '',                       -- 命中后的值（boolean/string/json 均存为文本）
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_targeting_fe ON feature_targeting_rules (feature_id, env_id, priority);

-- 用户级 feature 覆盖（优先级最高：用户覆盖 > 定向规则 > 基线规则）
CREATE TABLE IF NOT EXISTS user_feature_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    env_id INTEGER NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    feature_id INTEGER NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT 0,
    value TEXT DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (app_id, env_id, feature_id, user_id)
);

-- 操作审计日志
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER DEFAULT NULL REFERENCES apps(id) ON DELETE SET NULL,
    feature_id INTEGER DEFAULT NULL REFERENCES features(id) ON DELETE SET NULL,
    env_id INTEGER DEFAULT NULL REFERENCES environments(id) ON DELETE SET NULL,
    operator TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL,                        -- create / update / delete / toggle
    target_type TEXT NOT NULL,                   -- feature / targeting_rule
    target_id INTEGER NOT NULL,
    detail TEXT DEFAULT NULL,                    -- JSON 文本
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_app ON audit_logs (app_id);
CREATE INDEX IF NOT EXISTS idx_audit_feature ON audit_logs (feature_id);
CREATE INDEX IF NOT EXISTS idx_audit_env ON audit_logs (env_id);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at);

-- ============================================================
-- MySQL 版本（生产环境）见 deploy/init-mysql.sql
-- ============================================================
