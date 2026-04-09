package storage

import "gorm.io/gorm"

var DB *gorm.DB

// InitDB 初始化数据库连接
func InitDB(dsn string) error {
	// TODO
	return nil
}
