#!/bin/bash
# =============================================================
# auto-update.sh — Polling Script untuk Cron Job
# Lokasi di server: /opt/anjungan-poli/scripts/auto-update.sh
# =============================================================
# Daftarkan ke cron untuk berjalan setiap 5 menit:
#   crontab -e
#   */5 * * * * /opt/anjungan-poli/scripts/auto-update.sh
#
# Script ini HANYA mendeteksi apakah ada tag baru di GitHub.
# Jika ada, script akan memanggil deploy.sh secara otomatis.
# =============================================================

PROJECT_DIR="/opt/anjungan-poli"
LOG_FILE="$PROJECT_DIR/logs/auto-update.log"
DEPLOY_SCRIPT="$PROJECT_DIR/deploy.sh"

TIMESTAMP="[$(date '+%Y-%m-%d %H:%M:%S')]"

# Pastikan direktori log ada
mkdir -p "$PROJECT_DIR/logs"

# Masuk ke direktori project
cd "$PROJECT_DIR" || exit 1

# Fetch tag terbaru dari GitHub secara diam-diam
git fetch --tags --prune --quiet 2>/dev/null

# Tentukan tag aktif dan tag terbaru
LATEST_TAG=$(git tag -l "v*" | sort -V | tail -n 1)
CURRENT_TAG=$(git describe --tags --exact-match 2>/dev/null || echo "none")

# Jika tidak ada tag sama sekali, catat dan keluar
if [ -z "$LATEST_TAG" ]; then
    echo "$TIMESTAMP Tidak ada tag versi ditemukan di repository. Lewati." >> "$LOG_FILE"
    exit 0
fi

# Jika ada tag baru yang berbeda dari yang aktif, jalankan deployment
if [ "$CURRENT_TAG" != "$LATEST_TAG" ]; then
    echo "$TIMESTAMP Update terdeteksi: $CURRENT_TAG → $LATEST_TAG. Memulai deployment otomatis..." >> "$LOG_FILE"
    bash "$DEPLOY_SCRIPT" >> "$LOG_FILE" 2>&1
    echo "$TIMESTAMP Deployment selesai." >> "$LOG_FILE"
else
    echo "$TIMESTAMP Tidak ada pembaruan. Versi aktif: $CURRENT_TAG" >> "$LOG_FILE"
fi
