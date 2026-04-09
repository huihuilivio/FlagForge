package main

import (
	"log"

	"github.com/livio/flagforge/backend/api"
	"github.com/livio/flagforge/backend/storage"
)

func main() {
	if err := storage.InitDB("flagforge.db"); err != nil {
		log.Fatal("failed to init database:", err)
	}

	r := api.SetupRouter()
	r.Run(":8080")
}
