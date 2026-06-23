package handler

import (
	"anjungan-poli/backend/internal/websocket"

	"github.com/gin-gonic/gin"
)

type WebSocketHandler struct {
	hub *websocket.Hub
}

func NewWebSocketHandler(hub *websocket.Hub) *WebSocketHandler {
	return &WebSocketHandler{hub: hub}
}

// Handle memproses request upgrade koneksi WebSocket
func (h *WebSocketHandler) Handle(c *gin.Context) {
	h.hub.HandleWS(c.Writer, c.Request)
}
