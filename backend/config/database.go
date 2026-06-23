package config

import (
	"fmt"
	"log"
	"os"

	"github.com/redis/go-redis/v9"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// GetEnv helper untuk mengambil value dari environment variable dengan fallback default
func GetEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

// InitSIMRSDB menginisialisasi database SIMRS (Read-Only)
func InitSIMRSDB() *gorm.DB {
	host := GetEnv("SIMRS_DB_HOST", "192.168.11.50")
	port := GetEnv("SIMRS_DB_PORT", "3306")
	user := GetEnv("SIMRS_DB_USER", "rsds_db")
	pass := GetEnv("SIMRS_DB_PASSWORD", "rsdsD4t4b4s3")
	dbname := GetEnv("SIMRS_DB_NAME", "rsds_db")

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local", user, pass, host, port, dbname)
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Printf("Warning: Gagal terhubung ke database SIMRS: %v. Pastikan IP %s dapat diakses.", err, host)
		return nil
	}

	log.Println("Berhasil terhubung ke database SIMRS (Read-Only)")
	return db
}

// InitAnjunganDB menginisialisasi database lokal Anjungan (Read-Write)
func InitAnjunganDB() *gorm.DB {
	host := GetEnv("ANJUNGAN_DB_HOST", "localhost")
	port := GetEnv("ANJUNGAN_DB_PORT", "3306")
	user := GetEnv("ANJUNGAN_DB_USER", "anjungan_user")
	pass := GetEnv("ANJUNGAN_DB_PASSWORD", "anjungan_password")
	dbname := GetEnv("ANJUNGAN_DB_NAME", "anjungan_db")

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local", user, pass, host, port, dbname)
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatalf("Fatal: Gagal terhubung ke database lokal Anjungan: %v", err)
	}

	log.Println("Berhasil terhubung ke database Lokal Anjungan (Read-Write)")
	return db
}

// InitRedis menginisialisasi Redis client
func InitRedis() *redis.Client {
	host := GetEnv("REDIS_HOST", "localhost")
	port := GetEnv("REDIS_PORT", "6379")
	pass := GetEnv("REDIS_PASSWORD", "")

	rdb := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", host, port),
		Password: pass,
		DB:       0,
	})

	return rdb
}
