package api

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"goflagforge/model"
	"goflagforge/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const internalErr = "internal server error"

func logAndAbort(c *gin.Context, status int, err error, msg string) {
	log.Printf("[ERR] %s: %v", msg, err)
	c.JSON(status, gin.H{"error": internalErr})
}

var svc = service.NewFeatureService()

// parseQueryUint 解析查询参数中的 uint 值，返回 0 和 error 如果格式不合法
func parseQueryUint(c *gin.Context, key string) (uint, error) {
	v := c.Query(key)
	if v == "" {
		return 0, nil
	}
	n, err := strconv.ParseUint(v, 10, 64)
	if err != nil {
		return 0, err
	}
	return uint(n), nil
}

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
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "app or env not found"})
			return
		}
		logAndAbort(c, http.StatusInternalServerError, err, "EvaluateFeatures")
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
		n, err := strconv.ParseUint(v, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid app_id"})
			return
		}
		appID = uint(n)
	}
	features, err := svc.ListAll(appID)
	if err != nil {
		logAndAbort(c, http.StatusInternalServerError, err, "ListFeatures")
		return
	}
	c.JSON(http.StatusOK, features)
}

// CreateFeature 创建 feature
// POST /admin/feature
func CreateFeature(c *gin.Context) {
	var f model.Feature
	if err := c.ShouldBindJSON(&f); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if err := svc.Create(&f); err != nil {
		logAndAbort(c, http.StatusInternalServerError, err, "CreateFeature")
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
	origAppID := existing.AppID
	if err := c.ShouldBindJSON(existing); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	existing.ID = uint(id)
	existing.AppID = origAppID
	if err := svc.Update(existing); err != nil {
		logAndAbort(c, http.StatusInternalServerError, err, "UpdateFeature")
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
		logAndAbort(c, http.StatusInternalServerError, err, "DeleteFeature")
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
		logAndAbort(c, http.StatusInternalServerError, err, "ListApps")
		return
	}
	c.JSON(http.StatusOK, apps)
}

// CreateApp 创建应用
// POST /admin/app
func CreateApp(c *gin.Context) {
	var app model.App
	if err := c.ShouldBindJSON(&app); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if err := svc.CreateApp(&app); err != nil {
		logAndAbort(c, http.StatusInternalServerError, err, "CreateApp")
		return
	}
	c.JSON(http.StatusCreated, app)
}

// UpdateApp 更新应用
// PUT /admin/app/:id
func UpdateApp(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	existing, err := svc.GetAppByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "app not found"})
		return
	}
	origAppKey := existing.AppKey
	if err := c.ShouldBindJSON(existing); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	existing.ID = uint(id)
	existing.AppKey = origAppKey
	if err := svc.UpdateApp(existing); err != nil {
		logAndAbort(c, http.StatusInternalServerError, err, "UpdateApp")
		return
	}
	c.JSON(http.StatusOK, existing)
}

// DeleteApp 删除应用
// DELETE /admin/app/:id
func DeleteApp(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := svc.DeleteApp(uint(id)); err != nil {
		logAndAbort(c, http.StatusInternalServerError, err, "DeleteApp")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
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
		logAndAbort(c, http.StatusInternalServerError, err, "ListEnvs")
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	env.AppID = uint(appID)
	if err := svc.CreateEnv(&env); err != nil {
		logAndAbort(c, http.StatusInternalServerError, err, "CreateEnv")
		return
	}
	c.JSON(http.StatusCreated, env)
}

// UpdateEnv 更新环境
// PUT /admin/env/:id
func UpdateEnv(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	existing, err := svc.GetEnvByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "env not found"})
		return
	}
	origAppID := existing.AppID
	if err := c.ShouldBindJSON(existing); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	existing.ID = uint(id)
	existing.AppID = origAppID
	if err := svc.UpdateEnv(existing); err != nil {
		logAndAbort(c, http.StatusInternalServerError, err, "UpdateEnv")
		return
	}
	c.JSON(http.StatusOK, existing)
}

// DeleteEnv 删除环境
// DELETE /admin/env/:id
func DeleteEnv(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := svc.DeleteEnv(uint(id)); err != nil {
		logAndAbort(c, http.StatusInternalServerError, err, "DeleteEnv")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ---------- 管理接口：Targeting Rule ----------

// ListRules 列出定向规则
// GET /admin/rules?app_id=1&env_id=1&feature_id=1
func ListRules(c *gin.Context) {
	var appID, envID, featureID uint
	if v := c.Query("app_id"); v != "" {
		n, err := strconv.ParseUint(v, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid app_id"})
			return
		}
		appID = uint(n)
	}
	if v := c.Query("env_id"); v != "" {
		n, err := strconv.ParseUint(v, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid env_id"})
			return
		}
		envID = uint(n)
	}
	if v := c.Query("feature_id"); v != "" {
		n, err := strconv.ParseUint(v, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid feature_id"})
			return
		}
		featureID = uint(n)
	}
	rules, err := svc.ListRules(appID, envID, featureID)
	if err != nil {
		logAndAbort(c, http.StatusInternalServerError, err, "ListRules")
		return
	}
	c.JSON(http.StatusOK, rules)
}

// CreateRule 创建定向规则
// POST /admin/rule
func CreateRule(c *gin.Context) {
	var rule model.FeatureTargetingRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if err := validateConditionsJSON(rule.Conditions); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid conditions: " + err.Error()})
		return
	}
	if err := svc.CreateRule(&rule); err != nil {
		logAndAbort(c, http.StatusInternalServerError, err, "CreateRule")
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
	existing, err := svc.FindRuleByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "rule not found"})
		return
	}
	if err := c.ShouldBindJSON(existing); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	existing.ID = uint(id)
	if err := validateConditionsJSON(existing.Conditions); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid conditions: " + err.Error()})
		return
	}
	if err := svc.UpdateRule(existing); err != nil {
		logAndAbort(c, http.StatusInternalServerError, err, "UpdateRule")
		return
	}
	c.JSON(http.StatusOK, existing)
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
		logAndAbort(c, http.StatusInternalServerError, err, "DeleteRule")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ---------- 管理接口：Audit Log ----------

// ListAuditLogs 列出操作审计日志
// GET /admin/audit-logs?app_id=1&target_type=feature&limit=50&offset=0
func ListAuditLogs(c *gin.Context) {
	var appID uint
	if v := c.Query("app_id"); v != "" {
		n, err := strconv.ParseUint(v, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid app_id"})
			return
		}
		appID = uint(n)
	}
	targetType := c.Query("target_type")
	limit := 50
	offset := 0
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 200 {
			limit = n
		}
	}
	if v := c.Query("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}
	logs, total, err := svc.ListAuditLogs(appID, targetType, limit, offset)
	if err != nil {
		logAndAbort(c, http.StatusInternalServerError, err, "ListAuditLogs")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": logs, "total": total})
}

// ---------- 用户接口：Feature Override ----------

// SetOverride 用户设置自己的 feature 覆盖
// PUT /api/v1/override
func SetOverride(c *gin.Context) {
	var o model.UserFeatureOverride
	if err := c.ShouldBindJSON(&o); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if o.UserID == "" || o.AppID == 0 || o.EnvID == 0 || o.FeatureID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "app_id, env_id, feature_id and user_id are required"})
		return
	}
	// 校验引用的 app、env、feature 存在
	if _, err := svc.GetAppByID(o.AppID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "app not found"})
		return
	}
	if _, err := svc.GetEnvByID(o.EnvID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "env not found"})
		return
	}
	if _, err := svc.GetByID(o.FeatureID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "feature not found"})
		return
	}
	if err := svc.UpsertOverride(&o); err != nil {
		logAndAbort(c, http.StatusInternalServerError, err, "SetOverride")
		return
	}
	c.JSON(http.StatusOK, o)
}

// DeleteOverride 用户删除自己的 feature 覆盖（回退到规则求值）
// DELETE /api/v1/override?app_id=1&env_id=1&feature_id=1&user_id=alice
func DeleteOverride(c *gin.Context) {
	appID, err := parseQueryUint(c, "app_id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid app_id"})
		return
	}
	envID, err := parseQueryUint(c, "env_id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid env_id"})
		return
	}
	featureID, err := parseQueryUint(c, "feature_id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid feature_id"})
		return
	}
	userID := c.Query("user_id")
	if appID == 0 || envID == 0 || featureID == 0 || userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "app_id, env_id, feature_id and user_id are required"})
		return
	}
	if err := svc.DeleteOverride(uint(appID), uint(envID), uint(featureID), userID); err != nil {
		logAndAbort(c, http.StatusInternalServerError, err, "DeleteOverride")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "override deleted"})
}

// ListOverrides 列出用户的所有 feature 覆盖
// GET /api/v1/overrides?app_id=1&env_id=1&user_id=alice
func ListOverrides(c *gin.Context) {
	appID, err := parseQueryUint(c, "app_id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid app_id"})
		return
	}
	envID, err := parseQueryUint(c, "env_id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid env_id"})
		return
	}
	userID := c.Query("user_id")
	if appID == 0 || envID == 0 || userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "app_id, env_id and user_id are required"})
		return
	}
	overrides, err := svc.ListOverrides(uint(appID), uint(envID), userID)
	if err != nil {
		logAndAbort(c, http.StatusInternalServerError, err, "ListOverrides")
		return
	}
	c.JSON(http.StatusOK, overrides)
}

// validateConditionsJSON 校验 conditions JSON 格式是否合法
func validateConditionsJSON(raw string) error {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" || trimmed == "[]" || trimmed == "null" {
		return nil // match all — valid
	}
	// 必须是合法 JSON
	if !json.Valid([]byte(trimmed)) {
		return errors.New("malformed JSON")
	}
	// 必须是数组或对象
	if trimmed[0] != '[' && trimmed[0] != '{' {
		return errors.New("must be array or object")
	}
	// 校验嵌套深度
	if jsonDepth([]byte(trimmed)) > 20 {
		return errors.New("conditions nested too deep (max 20)")
	}
	return nil
}

// jsonDepth 计算 JSON 嵌套深度
func jsonDepth(data []byte) int {
	var maxD, cur int
	for _, b := range data {
		switch b {
		case '{', '[':
			cur++
			if cur > maxD {
				maxD = cur
			}
		case '}', ']':
			cur--
		}
	}
	return maxD
}
