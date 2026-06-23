#!/bin/bash
# =============================================================
# deploy.sh — Script Deployment Utama Anjungan Poli
# Lokasi di server: /opt/anjungan-poli/deploy.sh
# =============================================================
# Cara menjalankan manual:
#   bash /opt/anjungan-poli/deploy.sh
#
# Script ini akan otomatis dipanggil oleh scripts/auto-update.sh
# ketika ada GitHub Release baru terdeteksi.
# =============================================================

set -e

# --- Warna Output Terminal ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# --- Konfigurasi ---
PROJECT_DIR="/opt/anjungan-poli"
LOG_FILE="$PROJECT_DIR/logs/deploy.log"

# Pastikan direktori log ada
mkdir -p "$PROJECT_DIR/logs"

# Fungsi log ke terminal dan file sekaligus
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# =============================================================
# HEADER
# =============================================================
log "${YELLOW}=================================================="
log "  ANJUNGAN POLI — DEPLOYMENT SCRIPT"
log "  $(date '+%Y-%m-%d %H:%M:%S')"
log "==================================================${NC}"

# =============================================================
# [1/7] Validasi file .env
# =============================================================
log "\n${YELLOW}[1/7] Validasi konfigurasi environment...${NC}"

if [ ! -f "$PROJECT_DIR/.env" ]; then
    log "${RED}✘ Error: File $PROJECT_DIR/.env tidak ditemukan!${NC}"
    log "  Jalankan: cp $PROJECT_DIR/.env.example $PROJECT_DIR/.env"
    log "  Lalu isi nilainya: nano $PROJECT_DIR/.env"
    exit 1
fi

if [ ! -f "$PROJECT_DIR/backend/.env" ]; then
    log "${RED}✘ Error: File $PROJECT_DIR/backend/.env tidak ditemukan!${NC}"
    log "  Jalankan: cp $PROJECT_DIR/backend/.env.example $PROJECT_DIR/backend/.env"
    log "  Lalu isi nilainya: nano $PROJECT_DIR/backend/.env"
    exit 1
fi

if [ ! -f "$PROJECT_DIR/frontend/.env.production" ]; then
    log "${RED}✘ Error: File $PROJECT_DIR/frontend/.env.production tidak ditemukan!${NC}"
    log "  Jalankan: cp $PROJECT_DIR/frontend/.env.production.example $PROJECT_DIR/frontend/.env.production"
    log "  Lalu isi nilainya: nano $PROJECT_DIR/frontend/.env.production"
    exit 1
fi

log "${GREEN}✔ Semua file konfigurasi terverifikasi.${NC}"

# =============================================================
# [2/7] Fetch tag terbaru dari GitHub
# =============================================================
log "\n${YELLOW}[2/7] Mengambil informasi release terbaru dari GitHub...${NC}"

cd "$PROJECT_DIR"
git fetch --tags --prune

LATEST_TAG=$(git tag -l "v*" | sort -V | tail -n 1)
CURRENT_TAG=$(git describe --tags --exact-match 2>/dev/null || echo "none")

log "${BLUE}  Tag aktif saat ini : $CURRENT_TAG${NC}"
log "${BLUE}  Tag terbaru GitHub : $LATEST_TAG${NC}"

if [ -z "$LATEST_TAG" ]; then
    log "${RED}✘ Error: Tidak ada tag versi ditemukan di repository!${NC}"
    log "  Pastikan Anda sudah membuat GitHub Release dengan tag v1.0.0"
    exit 1
fi

if [ "$CURRENT_TAG" = "$LATEST_TAG" ]; then
    log "${GREEN}✔ Sudah versi terbaru ($LATEST_TAG). Tidak ada pembaruan yang perlu dilakukan.${NC}"
    exit 0
fi

# =============================================================
# [3/7] Checkout ke versi terbaru
# =============================================================
log "\n${YELLOW}[3/7] Checkout ke versi $LATEST_TAG...${NC}"

git checkout "$LATEST_TAG"

log "${GREEN}✔ Berhasil checkout ke $LATEST_TAG.${NC}"

# =============================================================
# [4/7] Build Docker Image
# =============================================================
log "\n${YELLOW}[4/7] Membangun Docker Image (proses ini membutuhkan beberapa menit)...${NC}"

docker compose build --no-cache

log "${GREEN}✔ Build Docker Image selesai.${NC}"

# =============================================================
# [5/7] Restart container dengan image baru
# =============================================================
log "\n${YELLOW}[5/7] Memulai ulang container dengan versi terbaru...${NC}"

docker compose up -d --force-recreate

log "${GREEN}✔ Container berhasil dijalankan.${NC}"

# =============================================================
# [6/7] Tunggu service siap menerima request
# =============================================================
log "\n${YELLOW}[6/7] Menunggu service siap (10 detik)...${NC}"
sleep 10

# =============================================================
# [7/7] Smoke Test — Verifikasi backend merespons
# =============================================================
log "\n${YELLOW}[7/7] Menjalankan smoke test backend API...${NC}"

# Ambil API token dari backend/.env
API_TOKEN=$(grep '^API_TOKEN=' "$PROJECT_DIR/backend/.env" | cut -d'=' -f2 | tr -d '\r' | tr -d ' ')

if [ -z "$API_TOKEN" ]; then
    log "${YELLOW}⚠ Peringatan: API_TOKEN tidak ditemukan di backend/.env, smoke test dilewati.${NC}"
else
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "X-API-Token: $API_TOKEN" \
        "http://localhost:8080/api/v1/queue?id_poli=1" \
        --max-time 10 \
        || echo "failed")

    if [ "$HTTP_STATUS" = "200" ]; then
        log "${GREEN}✔ Smoke Test SUKSES! Backend merespons dengan HTTP 200.${NC}"
    else
        log "${RED}✘ Smoke Test GAGAL! Backend mengembalikan status: $HTTP_STATUS${NC}"
        log "\nStatus container saat ini:"
        docker compose ps
        log "\nLog backend terbaru:"
        docker compose logs --tail=20 backend
        exit 1
    fi
fi

# =============================================================
# Reload Nginx jika aktif di host
# =============================================================
if systemctl is-active --quiet nginx; then
    log "\n${YELLOW}[Opsional] Memuat ulang konfigurasi Nginx...${NC}"
    sudo nginx -t && sudo systemctl reload nginx
    log "${GREEN}✔ Nginx berhasil di-reload.${NC}"
fi

# =============================================================
# FOOTER — Sukses
# =============================================================
log "\n${GREEN}=================================================="
log "  ✅ DEPLOYMENT $LATEST_TAG SELESAI SUKSES!"
log "  $(date '+%Y-%m-%d %H:%M:%S')"
log "==================================================${NC}"
