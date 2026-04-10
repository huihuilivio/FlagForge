package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func SetupRouter() *gin.Engine {
	r := gin.Default()
	r.MaxMultipartMemory = 2 << 20 // 2 MB

	// 请求体大小限制 1 MB
	r.Use(func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1<<20)
		c.Next()
	})

	// 客户端接口
	v1 := r.Group("/api/v1")
	{
		v1.GET("/features", GetFeatures)
		v1.PUT("/override", SetOverride)
		v1.DELETE("/override", DeleteOverride)
		v1.GET("/overrides", ListOverrides)
	}

	// 管理接口
	admin := r.Group("/admin")
	{
		// App
		admin.GET("/apps", ListApps)
		admin.POST("/app", CreateApp)
		admin.PUT("/app/:id", UpdateApp)
		admin.DELETE("/app/:id", DeleteApp)

		// Environment
		admin.GET("/apps/:app_id/envs", ListEnvs)
		admin.POST("/apps/:app_id/env", CreateEnv)
		admin.PUT("/env/:id", UpdateEnv)
		admin.DELETE("/env/:id", DeleteEnv)

		// Feature
		admin.GET("/features", ListFeatures)
		admin.POST("/feature", CreateFeature)
		admin.PUT("/feature/:id", UpdateFeature)
		admin.DELETE("/feature/:id", DeleteFeature)

		// Targeting Rule
		admin.GET("/rules", ListRules)
		admin.POST("/rule", CreateRule)
		admin.PUT("/rule/:id", UpdateRule)
		admin.DELETE("/rule/:id", DeleteRule)

		// Audit Log
		admin.GET("/audit-logs", ListAuditLogs)
	}

	return r
}
