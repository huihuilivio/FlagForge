package model

import "time"

type App struct {
	ID           uint          `json:"id" gorm:"primaryKey;autoIncrement"`
	AppKey       string        `json:"app_key" gorm:"uniqueIndex;size:50;not null"`
	Name         string        `json:"name" gorm:"size:100;not null"`
	Description  string        `json:"description" gorm:"size:500"`
	CreatedAt    time.Time     `json:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at"`
	Features     []Feature     `json:"features,omitempty" gorm:"foreignKey:AppID"`
	Environments []Environment `json:"environments,omitempty" gorm:"foreignKey:AppID"`
}

type Environment struct {
	ID           uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	AppID        uint      `json:"app_id" gorm:"uniqueIndex:uk_app_env;not null"`
	EnvKey       string    `json:"env_key" gorm:"uniqueIndex:uk_app_env;size:30;not null"`
	Name         string    `json:"name" gorm:"size:100"`
	SortOrder    int       `json:"sort_order" gorm:"default:0"`
	IsProduction bool      `json:"is_production" gorm:"default:false"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Feature struct {
	ID             uint                   `json:"id" gorm:"primaryKey;autoIncrement"`
	AppID          uint                   `json:"app_id" gorm:"uniqueIndex:uk_app_key;not null"`
	KeyName        string                 `json:"key_name" gorm:"uniqueIndex:uk_app_key;size:100;not null"`
	ValueType      string                 `json:"value_type" gorm:"size:20;not null;default:boolean"`
	Description    string                 `json:"description" gorm:"size:500"`
	CreatedAt      time.Time              `json:"created_at"`
	UpdatedAt      time.Time              `json:"updated_at"`
	App            *App                   `json:"app,omitempty" gorm:"foreignKey:AppID"`
	TargetingRules []FeatureTargetingRule `json:"targeting_rules,omitempty" gorm:"foreignKey:FeatureID"`
}

// FeatureTargetingRule 定向规则（多条件组合 AND/OR 求值）
// DB 只负责按 feature_id + env_id 存取、按 priority 排序
// conditions JSON 仅在应用层解析求值，不参与 SQL 查询
// 求值：按 Priority ASC, ID ASC 逐条匹配，首条命中即终止并返回结果
// conditions=[] 空数组作为 match-all 基线规则
type FeatureTargetingRule struct {
	ID         uint         `json:"id" gorm:"primaryKey;autoIncrement"`
	FeatureID  uint         `json:"feature_id" gorm:"index:idx_targeting_fe;not null"`
	EnvID      uint         `json:"env_id" gorm:"index:idx_targeting_fe;not null"`
	Name       string       `json:"name" gorm:"size:100"`
	Priority   int          `json:"priority" gorm:"index:idx_targeting_fe;not null;default:0"`
	Active     bool         `json:"active" gorm:"not null;default:true"`
	Conditions string       `json:"conditions" gorm:"type:text;not null;default:'[]'"`
	Enabled    bool         `json:"enabled" gorm:"default:false"`
	Value      string       `json:"value" gorm:"type:text"`
	CreatedAt  time.Time    `json:"created_at"`
	UpdatedAt  time.Time    `json:"updated_at"`
	Env        *Environment `json:"env,omitempty" gorm:"foreignKey:EnvID"`
}

type AuditLog struct {
	ID         uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	AppID      *uint     `json:"app_id" gorm:"index:idx_audit_app"`
	FeatureID  *uint     `json:"feature_id" gorm:"index:idx_audit_feature"`
	EnvID      *uint     `json:"env_id" gorm:"index:idx_audit_env"`
	Operator   string    `json:"operator" gorm:"size:100"`
	Action     string    `json:"action" gorm:"size:50;not null"`
	TargetType string    `json:"target_type" gorm:"size:50;not null"`
	TargetID   uint      `json:"target_id" gorm:"not null"`
	Detail     string    `json:"detail" gorm:"type:json"`
	CreatedAt  time.Time `json:"created_at"`
}

// UserFeatureOverride 用户级 feature 覆盖
// 优先级最高：用户覆盖 > 定向规则 > 基线规则
type UserFeatureOverride struct {
	ID        uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	AppID     uint      `json:"app_id" gorm:"uniqueIndex:uk_user_override;not null"`
	EnvID     uint      `json:"env_id" gorm:"uniqueIndex:uk_user_override;not null"`
	FeatureID uint      `json:"feature_id" gorm:"uniqueIndex:uk_user_override;not null"`
	UserID    string    `json:"user_id" gorm:"uniqueIndex:uk_user_override;size:100;not null"`
	Enabled   bool      `json:"enabled" gorm:"not null;default:false"`
	Value     string    `json:"value" gorm:"type:text"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
