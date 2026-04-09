package api

import "github.com/gin-gonic/gin"

func SetupRouter() *gin.Engine {
	r := gin.Default()

	// 客户端接口
	v1 := r.Group("/api/v1")
	{
		v1.GET("/features", GetFeatures)
	}

	// 管理接口
	admin := r.Group("/admin")
	{
		admin.GET("/features", ListFeatures)
		admin.POST("/feature", CreateFeature)
		admin.PUT("/feature/:id", UpdateFeature)
		admin.DELETE("/feature/:id", DeleteFeature)
	}

	return r
}
