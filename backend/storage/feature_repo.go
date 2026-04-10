package storage

import (
	"goflagforge/model"

	"gorm.io/gorm"
)

type FeatureRepo struct{}

// ---- App ----

func (r *FeatureRepo) ListApps() ([]model.App, error) {
	var apps []model.App
	err := DB.Find(&apps).Error
	return apps, err
}

func (r *FeatureRepo) FindAppByKey(appKey string) (*model.App, error) {
	var app model.App
	if err := DB.Where("app_key = ?", appKey).First(&app).Error; err != nil {
		return nil, err
	}
	return &app, nil
}

func (r *FeatureRepo) CreateApp(app *model.App) error {
	return DB.Create(app).Error
}

// ---- Environment ----

func (r *FeatureRepo) ListEnvsByApp(appID uint) ([]model.Environment, error) {
	var envs []model.Environment
	err := DB.Where("app_id = ?", appID).Order("sort_order ASC").Find(&envs).Error
	return envs, err
}

func (r *FeatureRepo) FindEnvByAppAndKey(appID uint, envKey string) (*model.Environment, error) {
	var env model.Environment
	if err := DB.Where("app_id = ? AND env_key = ?", appID, envKey).First(&env).Error; err != nil {
		return nil, err
	}
	return &env, nil
}

func (r *FeatureRepo) CreateEnv(env *model.Environment) error {
	return DB.Create(env).Error
}

// ---- Feature ----

func (r *FeatureRepo) FindAll(appID uint) ([]model.Feature, error) {
	var features []model.Feature
	q := DB.Preload("TargetingRules", func(db *gorm.DB) *gorm.DB {
		return db.Order("priority ASC, id ASC")
	})
	if appID > 0 {
		q = q.Where("app_id = ?", appID)
	}
	err := q.Find(&features).Error
	return features, err
}

func (r *FeatureRepo) FindByID(id uint) (*model.Feature, error) {
	var f model.Feature
	err := DB.Preload("TargetingRules", func(db *gorm.DB) *gorm.DB {
		return db.Order("priority ASC, id ASC")
	}).First(&f, id).Error
	if err != nil {
		return nil, err
	}
	return &f, nil
}

func (r *FeatureRepo) FindByAppWithRulesForEnv(appID, envID uint) ([]model.Feature, error) {
	var features []model.Feature
	err := DB.Preload("TargetingRules", func(db *gorm.DB) *gorm.DB {
		return db.Where("env_id = ? AND active = ?", envID, true).Order("priority ASC, id ASC")
	}).Where("app_id = ?", appID).Find(&features).Error
	return features, err
}

func (r *FeatureRepo) Create(feature *model.Feature) error {
	return DB.Create(feature).Error
}

func (r *FeatureRepo) Update(feature *model.Feature) error {
	return DB.Save(feature).Error
}

func (r *FeatureRepo) Delete(id uint) error {
	return DB.Delete(&model.Feature{}, id).Error
}

// ---- FeatureTargetingRule ----

func (r *FeatureRepo) CreateRule(rule *model.FeatureTargetingRule) error {
	return DB.Create(rule).Error
}

func (r *FeatureRepo) UpdateRule(rule *model.FeatureTargetingRule) error {
	return DB.Save(rule).Error
}

func (r *FeatureRepo) DeleteRule(id uint) error {
	return DB.Delete(&model.FeatureTargetingRule{}, id).Error
}

// ---- AuditLog ----

func (r *FeatureRepo) CreateAuditLog(log *model.AuditLog) error {
	return DB.Create(log).Error
}

// ---- UserFeatureOverride ----

func (r *FeatureRepo) FindOverridesByUser(appID, envID uint, userID string) ([]model.UserFeatureOverride, error) {
	var overrides []model.UserFeatureOverride
	err := DB.Where("app_id = ? AND env_id = ? AND user_id = ?", appID, envID, userID).Find(&overrides).Error
	return overrides, err
}

func (r *FeatureRepo) UpsertOverride(o *model.UserFeatureOverride) error {
	var existing model.UserFeatureOverride
	err := DB.Where("app_id = ? AND env_id = ? AND feature_id = ? AND user_id = ?",
		o.AppID, o.EnvID, o.FeatureID, o.UserID).First(&existing).Error
	if err == nil {
		existing.Enabled = o.Enabled
		existing.Value = o.Value
		*o = existing
		return DB.Save(&existing).Error
	}
	return DB.Create(o).Error
}

func (r *FeatureRepo) DeleteOverride(appID, envID, featureID uint, userID string) error {
	return DB.Where("app_id = ? AND env_id = ? AND feature_id = ? AND user_id = ?",
		appID, envID, featureID, userID).Delete(&model.UserFeatureOverride{}).Error
}
