package cache

// Cache feature 缓存接口
type Cache interface {
	Get(key string) (string, error)
	Set(key string, value string) error
	Delete(key string) error
}
