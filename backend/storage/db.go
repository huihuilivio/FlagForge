package storage

import (
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	"goflagforge/model"
)

var DB *gorm.DB

// InitDB 初始化 SQLite 数据库并自动建表
func InitDB(dbPath string) error {
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return err
	}

	// 自动迁移建表
	err = db.AutoMigrate(
		&model.App{},
		&model.Environment{},
		&model.Feature{},
		&model.FeatureTargetingRule{},
		&model.AuditLog{},
		&model.UserFeatureOverride{},
	)
	if err != nil {
		return err
	}

	DB = db
	return nil
}
