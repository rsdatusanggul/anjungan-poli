package main

import (
	"log"
	"time"

	"anjungan-poli/backend/config"
	"anjungan-poli/backend/internal/handler"
	"anjungan-poli/backend/internal/middleware"
	"anjungan-poli/backend/internal/websocket"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables dari .env file
	if err := godotenv.Load(); err != nil {
		log.Println("Info: File .env tidak ditemukan. Menggunakan environment variables sistem.")
	}

	// Inisialisasi Database
	simrsDB := config.InitSIMRSDB()
	anjunganDB := config.InitAnjunganDB()
	rdb := config.InitRedis()

	// Jalankan rutin pembersihan otomatis database lokal setiap 24 jam (Background Task)
	if anjunganDB != nil {
		go func() {
			for {
				log.Println("Menjalankan pembersihan berkala database lokal (Auto-Clean)...")
				cleanupLimit := time.Now().AddDate(0, 0, -7).Format("2006-01-02")
				
				result := anjunganDB.Exec("DELETE FROM queue_status WHERE tgl_registrasi < ?", cleanupLimit)
				if result.Error != nil {
					log.Printf("Gagal membersihkan database lokal: %v", result.Error)
				} else {
					log.Printf("Pembersihan database lokal berhasil. %d baris data sebelum tanggal %s telah dihapus.", result.RowsAffected, cleanupLimit)
				}
				
				// Tidur selama 24 jam sebelum pembersihan berikutnya
				time.Sleep(24 * time.Hour)
			}
		}()
	}

	// Inisialisasi WebSocket Hub
	hub := websocket.NewHub()
	go hub.Run()

	// Inisialisasi Gin Engine
	r := gin.Default()

	// Terapkan CORS Middleware
	r.Use(middleware.CORS())

	// Route websocket (tanpa API Token Auth)
	wsHandler := handler.NewWebSocketHandler(hub)
	r.GET("/ws", wsHandler.Handle)

	// API V1 Group
	api := r.Group("/api/v1")
	api.Use(middleware.APITokenAuth())
	{
		queueHandler := handler.NewQueueHandler(simrsDB, anjunganDB, rdb, hub)
		api.GET("/queue", queueHandler.GetQueue)
		api.GET("/poliklinik", queueHandler.GetPoliklinik)
		api.POST("/queue/call", queueHandler.CallPatient)
		api.POST("/queue/finish-call", queueHandler.FinishCall)
		api.POST("/queue/finish-examine", queueHandler.FinishExamine)
		api.POST("/queue/reset", queueHandler.ResetQueue)
	}

	port := config.GetEnv("PORT", "8080")
	log.Printf("Server Anjungan Antrian berjalan di port :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Fatal: Gagal menjalankan server HTTP: %v", err)
	}
}
