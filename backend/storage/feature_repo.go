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

func (r *FeatureRepo) UpdateApp(app *model.App) error {
	return DB.Save(app).Error
}

func (r *FeatureRepo) DeleteApp(id uint) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("feature_id IN (SELECT id FROM features WHERE app_id = ?)", id).Delete(&model.FeatureTargetingRule{}).Error; err != nil {
			return err
		}
		if err := tx.Where("app_id = ?", id).Delete(&model.UserFeatureOverride{}).Error; err != nil {
			return err
		}
		if err := tx.Where("app_id = ?", id).Delete(&model.Feature{}).Error; err != nil {
			return err
		}
		if err := tx.Where("app_id = ?", id).Delete(&model.Environment{}).Error; err != nil {
			return err
		}
		return tx.Delete(&model.App{}, id).Error
	})
}

func (r *FeatureRepo) FindAppByID(id uint) (*model.App, error) {
	var app model.App
	if err := DB.First(&app, id).Error; err != nil {
		return nil, err
	}
	return &app, nil
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

func (r *FeatureRepo) UpdateEnv(env *model.Environment) error {
	return DB.Save(env).Error
}

func (r *FeatureRepo) DeleteEnv(id uint) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("env_id = ?", id).Delete(&model.FeatureTargetingRule{}).Error; err != nil {
			return err
		}
		if err := tx.Where("env_id = ?", id).Delete(&model.UserFeatureOverride{}).Error; err != nil {
			return err
		}
		return tx.Delete(&model.Environment{}, id).Error
	})
}

func (r *FeatureRepo) FindEnvByID(id uint) (*model.Environment, error) {
	var env model.Environment
	if err := DB.First(&env, id).Error; err != nil {
		return nil, err
	}
	return &env, nil
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
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("feature_id = ?", id).Delete(&model.FeatureTargetingRule{}).Error; err != nil {
			return err
		}
		if err := tx.Where("feature_id = ?", id).Delete(&model.UserFeatureOverride{}).Error; err != nil {
			return err
		}
		return tx.Delete(&model.Feature{}, id).Error
	})
}

// ---- FeatureTargetingRule ----

func (r *FeatureRepo) ListRules(appID, envID, featureID uint) ([]model.FeatureTargetingRule, error) {
	var rules []model.FeatureTargetingRule
	q := DB.Preload("Env")
	if featureID > 0 {
		q = q.Where("feature_id = ?", featureID)
	}
	if envID > 0 {
		q = q.Where("env_id = ?", envID)
	}
	if appID > 0 {
		// rules don't have app_id directly; join through features
		q = q.Where("feature_id IN (SELECT id FROM features WHERE app_id = ?)", appID)
	}
	err := q.Order("feature_id ASC, priority ASC, id ASC").Find(&rules).Error
	return rules, err
}

func (r *FeatureRepo) FindRuleByID(id uint) (*model.FeatureTargetingRule, error) {
	var rule model.FeatureTargetingRule
	if err := DB.First(&rule, id).Error; err != nil {
		return nil, err
	}
	return &rule, nil
}

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

func (r *FeatureRepo) ListAuditLogs(appID uint, targetType string, limit, offset int) ([]model.AuditLog, int64, error) {
	var logs []model.AuditLog
	var total int64
	q := DB.Model(&model.AuditLog{})
	if appID > 0 {
		q = q.Where("app_id = ?", appID)
	}
	if targetType != "" {
		q = q.Where("target_type = ?", targetType)
	}
	if err := q.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if limit <= 0 {
		limit = 50
	}
	err := q.Order("id DESC").Limit(limit).Offset(offset).Find(&logs).Error
	return logs, total, err
}

// ---- UserFeatureOverride ----

func (r *FeatureRepo) FindOverridesByUser(appID, envID uint, userID string) ([]model.UserFeatureOverride, error) {
	var overrides []model.UserFeatureOverride
	err := DB.Where("app_id = ? AND env_id = ? AND user_id = ?", appID, envID, userID).Find(&overrides).Error
	return overrides, err
}

func (r *FeatureRepo) UpsertOverride(o *model.UserFeatureOverride) error {
	// 原子 upsert：冲突时更新 enabled 和 value
	err := DB.Where("app_id = ? AND env_id = ? AND feature_id = ? AND user_id = ?",
		o.AppID, o.EnvID, o.FeatureID, o.UserID).
		Assign(model.UserFeatureOverride{Enabled: o.Enabled, Value: o.Value}).
		FirstOrCreate(o).Error
	return err
}

func (r *FeatureRepo) DeleteOverride(appID, envID, featureID uint, userID string) error {
	return DB.Where("app_id = ? AND env_id = ? AND feature_id = ? AND user_id = ?",
		appID, envID, featureID, userID).Delete(&model.UserFeatureOverride{}).Error
}
