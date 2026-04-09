package main

import (
	"github.com/livio/flagforge/backend/api"
)

func main() {
	r := api.SetupRouter()
	r.Run(":8080")
}
