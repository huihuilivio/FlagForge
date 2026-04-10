package api

import "github.com/gin-gonic/gin"

func SetupRouter() *gin.Engine {
	r := gin.Default()

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

		// Environment
		admin.GET("/apps/:app_id/envs", ListEnvs)
		admin.POST("/apps/:app_id/env", CreateEnv)

		// Feature
		admin.GET("/features", ListFeatures)
		admin.POST("/feature", CreateFeature)
		admin.PUT("/feature/:id", UpdateFeature)
		admin.DELETE("/feature/:id", DeleteFeature)

		// Targeting Rule
		admin.POST("/rule", CreateRule)
		admin.PUT("/rule/:id", UpdateRule)
		admin.DELETE("/rule/:id", DeleteRule)
	}

	return r
}
