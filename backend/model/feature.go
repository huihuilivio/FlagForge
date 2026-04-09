package model

import "time"

type Feature struct {
	ID          uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	KeyName     string    `json:"key_name" gorm:"uniqueIndex;size:100;not null"`
	ValueType   string    `json:"value_type" gorm:"size:20;not null;default:boolean"`
	Description string    `json:"description" gorm:"size:500"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Rules       []FeatureRule      `json:"rules,omitempty" gorm:"foreignKey:FeatureID"`
	Whitelist   []FeatureWhitelist `json:"whitelist,omitempty" gorm:"foreignKey:FeatureID"`
}

type FeatureRule struct {
	ID         uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	FeatureID  uint      `json:"feature_id" gorm:"uniqueIndex:uk_feature_env;not null"`
	Env        string    `json:"env" gorm:"uniqueIndex:uk_feature_env;size:20;not null;default:prod"`
	Enabled    bool      `json:"enabled" gorm:"default:false"`
	Value      string    `json:"value" gorm:"size:500"`
	Percentage uint8     `json:"percentage" gorm:"default:100"`
	MinVersion string    `json:"min_version" gorm:"size:20"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type FeatureWhitelist struct {
	ID        uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	FeatureID uint      `json:"feature_id" gorm:"uniqueIndex:uk_feature_env_user;not null"`
	Env       string    `json:"env" gorm:"uniqueIndex:uk_feature_env_user;size:20;not null;default:prod"`
	UserID    string    `json:"user_id" gorm:"uniqueIndex:uk_feature_env_user;size:100;not null"`
	CreatedAt time.Time `json:"created_at"`
}

type AuditLog struct {
	ID         uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	Operator   string    `json:"operator" gorm:"size:100"`
	Action     string    `json:"action" gorm:"size:50;not null"`
	TargetType string    `json:"target_type" gorm:"size:50;not null"`
	TargetID   uint      `json:"target_id" gorm:"not null"`
	Detail     string    `json:"detail" gorm:"type:json"`
	CreatedAt  time.Time `json:"created_at"`
}
