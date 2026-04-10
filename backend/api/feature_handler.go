package api

import (
	"net/http"
	"strconv"
	"strings"

	"goflagforge/model"
	"goflagforge/service"

	"github.com/gin-gonic/gin"
)

var svc = service.NewFeatureService()

// ---------- 客户端接口 ----------

// GetFeatures 客户端获取 feature 开关状态
// GET /api/v1/features?app_key=xxx&env_key=dev&user_id=alice&version=2.0.0&platform=ios&attr_region=cn&attr_channel=beta
func GetFeatures(c *gin.Context) {
	appKey := c.Query("app_key")
	envKey := c.Query("env_key")
	if appKey == "" || envKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "app_key and env_key are required"})
		return
	}
	// 解析 attr_ 前缀的扩展属性
	attrs := make(map[string]string)
	for key, values := range c.Request.URL.Query() {
		if strings.HasPrefix(key, "attr_") && len(values) > 0 {
			attrs[strings.TrimPrefix(key, "attr_")] = values[0]
		}
	}
	ctx := service.EvalContext{
		UserID:   c.Query("user_id"),
		Version:  c.Query("version"),
		Platform: c.Query("platform"),
		Attrs:    attrs,
	}
	result, err := svc.EvaluateFeatures(appKey, envKey, ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// ---------- 管理接口：Feature ----------

// ListFeatures 管理后台列出 feature
// GET /admin/features?app_id=1
func ListFeatures(c *gin.Context) {
	var appID uint
	if v := c.Query("app_id"); v != "" {
		n, _ := strconv.ParseUint(v, 10, 64)
		appID = uint(n)
	}
	features, err := svc.ListAll(appID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, features)
}

// CreateFeature 创建 feature
// POST /admin/feature
func CreateFeature(c *gin.Context) {
	var f model.Feature
	if err := c.ShouldBindJSON(&f); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := svc.Create(&f); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, f)
}

// UpdateFeature 更新 feature
// PUT /admin/feature/:id
func UpdateFeature(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	existing, err := svc.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "feature not found"})
		return
	}
	if err := c.ShouldBindJSON(existing); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	existing.ID = uint(id)
	if err := svc.Update(existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, existing)
}

// DeleteFeature 删除 feature
// DELETE /admin/feature/:id
func DeleteFeature(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := svc.Delete(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ---------- 管理接口：App ----------

// ListApps 列出所有应用
// GET /admin/apps
func ListApps(c *gin.Context) {
	apps, err := svc.ListApps()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, apps)
}

// CreateApp 创建应用
// POST /admin/app
func CreateApp(c *gin.Context) {
	var app model.App
	if err := c.ShouldBindJSON(&app); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := svc.CreateApp(&app); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, app)
}

// ---------- 管理接口：Environment ----------

// ListEnvs 列出某应用的环境
// GET /admin/apps/:app_id/envs
func ListEnvs(c *gin.Context) {
	appID, err := strconv.ParseUint(c.Param("app_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid app_id"})
		return
	}
	envs, err := svc.ListEnvs(uint(appID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, envs)
}

// CreateEnv 创建环境
// POST /admin/apps/:app_id/env
func CreateEnv(c *gin.Context) {
	appID, err := strconv.ParseUint(c.Param("app_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid app_id"})
		return
	}
	var env model.Environment
	if err := c.ShouldBindJSON(&env); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	env.AppID = uint(appID)
	if err := svc.CreateEnv(&env); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, env)
}

// ---------- 管理接口：Targeting Rule ----------

// CreateRule 创建定向规则
// POST /admin/rule
func CreateRule(c *gin.Context) {
	var rule model.FeatureTargetingRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := svc.CreateRule(&rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, rule)
}

// UpdateRule 更新定向规则
// PUT /admin/rule/:id
func UpdateRule(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var rule model.FeatureTargetingRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	rule.ID = uint(id)
	if err := svc.UpdateRule(&rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, rule)
}

// DeleteRule 删除定向规则
// DELETE /admin/rule/:id
func DeleteRule(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := svc.DeleteRule(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ---------- 用户接口：Feature Override ----------

// SetOverride 用户设置自己的 feature 覆盖
// PUT /api/v1/override
func SetOverride(c *gin.Context) {
	var o model.UserFeatureOverride
	if err := c.ShouldBindJSON(&o); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if o.UserID == "" || o.AppID == 0 || o.EnvID == 0 || o.FeatureID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "app_id, env_id, feature_id and user_id are required"})
		return
	}
	if err := svc.UpsertOverride(&o); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, o)
}

// DeleteOverride 用户删除自己的 feature 覆盖（回退到规则求值）
// DELETE /api/v1/override?app_id=1&env_id=1&feature_id=1&user_id=alice
func DeleteOverride(c *gin.Context) {
	appID, _ := strconv.ParseUint(c.Query("app_id"), 10, 64)
	envID, _ := strconv.ParseUint(c.Query("env_id"), 10, 64)
	featureID, _ := strconv.ParseUint(c.Query("feature_id"), 10, 64)
	userID := c.Query("user_id")
	if appID == 0 || envID == 0 || featureID == 0 || userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "app_id, env_id, feature_id and user_id are required"})
		return
	}
	if err := svc.DeleteOverride(uint(appID), uint(envID), uint(featureID), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "override deleted"})
}

// ListOverrides 列出用户的所有 feature 覆盖
// GET /api/v1/overrides?app_id=1&env_id=1&user_id=alice
func ListOverrides(c *gin.Context) {
	appID, _ := strconv.ParseUint(c.Query("app_id"), 10, 64)
	envID, _ := strconv.ParseUint(c.Query("env_id"), 10, 64)
	userID := c.Query("user_id")
	if appID == 0 || envID == 0 || userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "app_id, env_id and user_id are required"})
		return
	}
	overrides, err := svc.ListOverrides(uint(appID), uint(envID), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, overrides)
}
