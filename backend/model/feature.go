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

// FeatureTargetingRule 定向规则（统一基线、白名单、用户覆盖、灰度、版本等）
// 求值：按 Priority ASC 逐条匹配，首条命中即终止并返回结果
// UNIQUE(feature_id, env_id, priority) 保证同环境下无优先级冲突
// match_type=all 作为最低优先级的基线规则（替代原 feature_rules）
type FeatureTargetingRule struct {
	ID         uint         `json:"id" gorm:"primaryKey;autoIncrement"`
	FeatureID  uint         `json:"feature_id" gorm:"uniqueIndex:uk_targeting_priority;not null"`
	EnvID      uint         `json:"env_id" gorm:"uniqueIndex:uk_targeting_priority;not null"`
	Name       string       `json:"name" gorm:"size:100"`
	Priority   int          `json:"priority" gorm:"uniqueIndex:uk_targeting_priority;not null;default:0"`
	Active     bool         `json:"active" gorm:"not null;default:true"`
	MatchType  string       `json:"match_type" gorm:"size:30;not null"`
	MatchValue string       `json:"match_value" gorm:"type:text"`
	Enabled    bool         `json:"enabled" gorm:"default:false"`
	Value      string       `json:"value" gorm:"size:500"`
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
