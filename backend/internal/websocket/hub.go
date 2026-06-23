package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Izinkan semua origin untuk dev/production
	},
}

// Client merepresentasikan satu koneksi WebSocket aktif
type Client struct {
	Hub    *Hub
	Conn   *websocket.Conn
	Send   chan []byte
	KdPoli string
}

// Hub mengelola semua koneksi WebSocket aktif
type Hub struct {
	Clients    map[*Client]bool
	Broadcast  chan []byte
	Register   chan *Client
	Unregister chan *Client
	mu         sync.RWMutex
}

// NewHub menginstansiasi Hub baru
func NewHub() *Hub {
	return &Hub{
		Clients:    make(map[*Client]bool),
		Broadcast:  make(chan []byte, 256),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
	}
}

// Run menjalankan event loop Hub
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			h.Clients[client] = true
			h.mu.Unlock()
			log.Printf("WebSocket client terhubung untuk poli: %s", client.KdPoli)

		case client := <-h.Unregister:
			h.mu.Lock()
			if _, ok := h.Clients[client]; ok {
				delete(h.Clients, client)
				close(client.Send)
				log.Printf("WebSocket client terputus untuk poli: %s", client.KdPoli)
			}
			h.mu.Unlock()

		case message := <-h.Broadcast:
			// Parse message untuk mengetahui target kd_poli (jika perlu filter)
			var parsed map[string]interface{}
			kdPoliFilter := ""
			if err := json.Unmarshal(message, &parsed); err == nil {
				if eventData, ok := parsed["data"].(map[string]interface{}); ok {
					if kdPoliVal, ok := eventData["kd_poli"].(string); ok {
						kdPoliFilter = kdPoliVal
					}
				}
			}

			h.mu.RLock()
			for client := range h.Clients {
				// Broadcast hanya dikirim ke client dengan kd_poli yang sama
				if kdPoliFilter == "" || client.KdPoli == kdPoliFilter {
					select {
					case client.Send <- message:
					default:
						h.mu.RUnlock()
						h.mu.Lock()
						close(client.Send)
						delete(h.Clients, client)
						h.mu.Unlock()
						h.mu.RLock()
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

// BroadcastQueueUpdate mengirim update antrian ke semua client
func (h *Hub) BroadcastQueueUpdate(kdPoli string, payload interface{}) {
	data, err := json.Marshal(map[string]interface{}{
		"event": "queue_updated",
		"data": map[string]interface{}{
			"kd_poli": kdPoli,
			"payload": payload,
		},
	})
	if err != nil {
		log.Printf("Gagal marshal broadcast payload: %v", err)
		return
	}
	h.Broadcast <- data
}

// HandleWS menangani upgrade koneksi HTTP ke WebSocket
func (h *Hub) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Gagal mengupgrade koneksi ke WebSocket: %v", err)
		return
	}

	kdPoli := r.URL.Query().Get("kd_poli")
	if kdPoli == "" {
		kdPoli = "U001" // Default fallback
	}

	client := &Client{
		Hub:    h,
		Conn:   conn,
		Send:   make(chan []byte, 256),
		KdPoli: kdPoli,
	}

	h.Register <- client

	// Start read/write pumps
	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()

	for {
		_, _, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error read pump: %v", err)
			}
			break
		}
	}
}

func (c *Client) writePump() {
	defer func() {
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Kosongkan sisa buffer send jika ada
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}
		}
	}
}
