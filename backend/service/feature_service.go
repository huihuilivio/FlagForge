package service

import "github.com/livio/flagforge/backend/model"

type FeatureService struct{}

// EvaluateFeatures 根据用户信息计算所有 feature 的开关状态
func (s *FeatureService) EvaluateFeatures(userID string, version string) (map[string]bool, error) {
	// TODO
	return nil, nil
}

// ListAll 列出所有 feature
func (s *FeatureService) ListAll() ([]model.Feature, error) {
	// TODO
	return nil, nil
}

// Create 创建 feature
func (s *FeatureService) Create(feature *model.Feature) error {
	// TODO
	return nil
}

// Update 更新 feature
func (s *FeatureService) Update(feature *model.Feature) error {
	// TODO
	return nil
}

// Delete 删除 feature
func (s *FeatureService) Delete(id int) error {
	// TODO
	return nil
}

// IsEnabled 判断单个 feature 对某用户是否启用
func (s *FeatureService) IsEnabled(feature model.Feature, userID string) bool {
	// TODO
	return false
}
