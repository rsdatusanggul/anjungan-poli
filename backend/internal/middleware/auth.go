package middleware

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

// APITokenAuth memvalidasi request menggunakan token API dari env
func APITokenAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("X-API-Token")
		expectedToken := os.Getenv("API_TOKEN")

		if expectedToken == "" {
			expectedToken = "supersecrettoken123" // Fallback default
		}

		if token != expectedToken {
			c.JSON(http.StatusUnauthorized, gin.H{
				"status":  "error",
				"message": "Token API tidak valid atau tidak disertakan",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
