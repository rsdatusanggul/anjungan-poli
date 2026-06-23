<div align="center">

# 🏥 Anjungan Antrian Poliklinik
### Sistem Informasi Antrian Real-Time Poliklinik
**RSUD Datu Sanggul — Tabalong, Kalimantan Selatan**

![Version](https://img.shields.io/badge/versi-1.0.0-blue?style=for-the-badge)
![Backend](https://img.shields.io/badge/Backend-Go%20%2F%20Gin-00ADD8?style=for-the-badge&logo=go)
![Frontend](https://img.shields.io/badge/Frontend-Next.js%2016-000000?style=for-the-badge&logo=nextdotjs)
![Database](https://img.shields.io/badge/Database-MariaDB-003545?style=for-the-badge&logo=mariadb)
![Cache](https://img.shields.io/badge/Cache-Redis-DC382D?style=for-the-badge&logo=redis)
![Container](https://img.shields.io/badge/Deploy-Docker-2496ED?style=for-the-badge&logo=docker)

</div>

---

## 📋 Daftar Isi

- [Tentang Aplikasi](#-tentang-aplikasi)
- [Fitur Utama](#-fitur-utama)
- [Arsitektur Sistem](#️-arsitektur-sistem)
- [Tech Stack](#-tech-stack)
- [Struktur Direktori](#-struktur-direktori)
- [Alur Kerja Sistem](#-alur-kerja-sistem)
- [API Reference](#-api-reference)
- [Instalasi & Menjalankan Lokal](#-instalasi--menjalankan-lokal)
- [Konfigurasi Environment](#️-konfigurasi-environment)
- [Deployment ke Server](#-deployment-ke-server)
- [Keamanan](#-keamanan)

---

## 📌 Tentang Aplikasi

**Anjungan Antrian Poliklinik** adalah sistem web berbasis real-time yang dirancang untuk membantu petugas poliklinik RSUD Datu Sanggul dalam mengelola antrian pasien secara efisien dan transparan.

Sistem ini terdiri dari **dua tampilan utama** yang berjalan di browser:

| Tampilan | Pengguna | Fungsi |
|---|---|---|
| 🖥️ **Anjungan Pasien** | Pasien di ruang tunggu | Melihat status antrian yang sedang berjalan secara real-time |
| 🖱️ **Anjungan Petugas** | Staff / Perawat poliklinik | Memanggil pasien, mengelola urutan antrian, dan memantau status |

> **Tanpa login, tanpa antrian manual** — Data antrian diambil langsung dari database SIMRS rumah sakit, ditampilkan secara otomatis dan real-time melalui WebSocket.

---

## ✨ Fitur Utama

### Anjungan Pasien
- ✅ Menampilkan **nomor antrian yang sedang dipanggil** dengan highlight jelas
- ✅ Menampilkan **nomor antrian berikutnya** (next queue)
- ✅ Menampilkan **pasien yang sedang diperiksa** oleh dokter
- ✅ Menampilkan **daftar antrian menunggu** secara lengkap
- ✅ Update otomatis **real-time via WebSocket** — tanpa perlu refresh halaman
- ✅ Desain besar dan mudah dibaca dari jarak jauh (layar TV / kiosk)

### Anjungan Petugas
- ✅ Daftar pasien **MENUNGGU** dengan tombol **Panggil**
- ✅ Daftar pasien **DIPANGGIL** dengan tombol **Selesai Panggil** dan **Reset**
- ✅ Daftar pasien **DIPERIKSA** dengan tombol **Selesai Periksa** dan **Reset**
- ✅ Daftar pasien **SELESAI** dengan tombol **Reset** (batalkan jika salah)
- ✅ Perubahan status menyebar ke **semua layar terhubung secara instan**
- ✅ Desain modern dan responsif

### Sistem & Backend
- ✅ **Sinkronisasi otomatis** dengan database SIMRS rumah sakit
- ✅ **Redis caching** — respons cepat, beban database minimal
- ✅ **Auto-cleanup** — data antrian lama (>7 hari) dibersihkan otomatis
- ✅ **Fallback / Simulation Mode** — sistem tetap berjalan meski koneksi ke SIMRS terputus
- ✅ **Token API** untuk mengamankan semua endpoint

---

## 🏛️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│                        JARINGAN INTRANET RS                     │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   DATABASE   │    │   VPS/SERVER │    │   KLIEN BROWSER  │  │
│  │              │    │              │    │                  │  │
│  │  SIMRS DB    │◄───┤   Backend    │◄──►│  Anjungan Pasien │  │
│  │  (Read Only) │    │   Go / Gin   │    │  (Layar TV/Kiosk)│  │
│  │              │    │   Port 8080  │    └──────────────────┘  │
│  │  Anjungan DB │◄──►│              │                          │
│  │  (Read-Write)│    │   + Redis    │    ┌──────────────────┐  │
│  └──────────────┘    │   Port 6379  │◄──►│  Anjungan Petugas│  │
│                      │              │    │  (PC Petugas)    │  │
│                      │   Frontend   │    └──────────────────┘  │
│                      │   Next.js    │                          │
│                      │   Port 3000  │                          │
│                      └──────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

### Aliran Data Real-Time

```
Petugas klik "Panggil"
        │
        ▼
POST /api/v1/queue/call     ← Backend memvalidasi & update DB lokal
        │
        ▼
Invalidasi Redis Cache      ← Data lama dihapus agar fresh
        │
        ▼
WebSocket Broadcast         ← Backend kirim sinyal "refresh" ke semua klien
        │
        ▼
Semua Browser Terhubung     ← Frontend fetch data terbaru otomatis
        │
        ▼
Layar Pasien & Petugas      ← Tampilan diperbarui secara real-time
```

---

## 🛠 Tech Stack

| Layer | Teknologi | Versi | Fungsi |
|---|---|---|---|
| **Backend** | Go (Golang) | 1.21+ | Server utama, business logic |
| **Framework** | Gin | v1.x | HTTP routing & middleware |
| **ORM** | GORM | v2.x | Akses database |
| **Frontend** | Next.js | 16.x | UI React dengan SSR/SSG |
| **UI Library** | Shadcn UI + Tailwind CSS | 4.x | Komponen antarmuka |
| **Bahasa** | TypeScript | 5.x | Type-safe JavaScript |
| **Database Utama** | MariaDB / MySQL | 11.4 | Penyimpanan data antrian lokal |
| **Database SIMRS** | MySQL (External) | - | Sumber data pasien (read-only) |
| **Cache** | Redis | 7.2 | Caching data antrian (TTL 5 menit) |
| **Real-time** | WebSocket (native) | - | Update tampilan instan |
| **Deployment** | Docker + Docker Compose | v5.x | Containerisasi semua service |

---

## 📁 Struktur Direktori

```
anjungan-poli/
├── backend/                    ← Service backend (Go)
│   ├── main.go                 ← Entry point, inisialisasi server
│   ├── Dockerfile              ← Multi-stage build backend
│   ├── .env.example            ← Template konfigurasi backend
│   ├── go.mod                  ← Go module dependencies
│   ├── config/                 ← Koneksi database & Redis
│   └── internal/
│       ├── handler/
│       │   ├── queue.go        ← Semua logic antrian (core business)
│       │   └── websocket.go    ← Handler koneksi WebSocket
│       ├── middleware/         ← CORS + API Token Auth
│       ├── model/              ← Struktur data (struct Go)
│       └── websocket/          ← WebSocket Hub & broadcasting
│
├── frontend/                   ← Service frontend (Next.js)
│   ├── Dockerfile              ← Multi-stage build frontend
│   ├── .env.production.example ← Template konfigurasi frontend
│   ├── next.config.ts          ← Next.js config (standalone output)
│   └── src/
│       ├── app/
│       │   ├── page.tsx        ← Halaman utama / pemilihan mode
│       │   ├── pasien/         ← Tampilan Anjungan Pasien
│       │   └── petugas/        ← Tampilan Anjungan Petugas
│       ├── components/         ← Komponen UI yang dapat digunakan ulang
│       ├── hooks/              ← Custom React hooks (termasuk WebSocket)
│       └── lib/                ← Utilitas, API client, helpers
│
├── database/
│   └── init.sql                ← SQL inisialisasi schema database lokal
│
├── docker-compose.yml          ← Orkestrasi semua service
├── deploy.sh                   ← Script otomasi deployment utama
├── scripts/
│   └── auto-update.sh          ← Polling cron untuk deteksi release baru
├── .env.example                ← Template environment root
└── .gitignore
```

---

## 🔄 Alur Kerja Sistem

### Status Antrian

Setiap pasien dalam antrian memiliki satu dari empat status:

```
MENUNGGU ──[Panggil]──► DIPANGGIL ──[Selesai Panggil]──► DIPERIKSA ──[Selesai Periksa]──► SELESAI
    ▲                       │                                  │                               │
    └──────────────[Reset]──┘──────────────────────[Reset]─────┘──────────────────[Reset]─────┘
```

| Status | Keterangan | Warna Indikator |
|---|---|---|
| `MENUNGGU` | Pasien terdaftar, belum dipanggil | 🔵 Biru |
| `DIPANGGIL` | Petugas sudah menekan tombol "Panggil" | 🟡 Kuning |
| `DIPERIKSA` | Pasien sudah masuk ruang dokter | 🟢 Hijau |
| `SELESAI` | Pemeriksaan selesai | ⚫ Abu-abu |

### Sinkronisasi Data

Saat frontend memuat data antrian:

1. **Backend** menerima request `GET /api/v1/queue?kd_poli=XXX`
2. **Redis** dicek terlebih dahulu — jika ada cache valid (TTL 5 menit), langsung dikembalikan
3. Jika cache miss, **SIMRS DB** diquery untuk data registrasi hari ini
4. Data baru disinkronisasikan ke **Anjungan DB** (database lokal Docker)
5. Status antrian dikategorikan dan response dikembalikan
6. Data disimpan ke **Redis** untuk request berikutnya

> **Fallback Mode**: Jika koneksi ke SIMRS terputus, sistem beralih ke data simulasi bawaan agar tetap bisa didemonstrasikan dan diuji.

---

## 📡 API Reference

Semua endpoint (kecuali WebSocket) memerlukan header autentikasi:

```http
X-API-Token: <token_rahasia_anda>
```

### Endpoint Antrian

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/api/v1/queue?kd_poli={kode}` | Ambil semua data antrian poliklinik |
| `GET` | `/api/v1/poliklinik` | Ambil daftar poliklinik aktif |
| `POST` | `/api/v1/queue/call` | Panggil pasien (status → DIPANGGIL) |
| `POST` | `/api/v1/queue/finish-call` | Selesai panggil (status → DIPERIKSA) |
| `POST` | `/api/v1/queue/finish-examine` | Selesai periksa (status → SELESAI) |
| `POST` | `/api/v1/queue/reset` | Reset status kembali ke MENUNGGU |
| `GET` | `/ws` | Koneksi WebSocket (tanpa token) |

### Contoh Request & Response

**GET `/api/v1/queue?kd_poli=INT`**

```json
{
  "status": "success",
  "data": {
    "kd_poli": "INT",
    "nm_poli": "KLINIK PENYAKIT DALAM",
    "tgl_registrasi": "2026-06-23",
    "current_calling": {
      "no_reg": "A003",
      "nm_pasien": "BUDI SANTOSO",
      "status": "DIPANGGIL"
    },
    "current_examining": {
      "no_reg": "A001",
      "nm_pasien": "AHMAD FAUZI",
      "status": "DIPERIKSA"
    },
    "next_queue": {
      "no_reg": "A004",
      "nm_pasien": "DEWI LESTARI",
      "status": "MENUNGGU"
    },
    "waiting": [...],
    "called": [...],
    "examining": [...],
    "finished": [...],
    "summary": {
      "total_menunggu": 5,
      "total_dipanggil": 1,
      "total_diperiksa": 1,
      "total_selesai": 2
    }
  }
}
```

**POST `/api/v1/queue/call`**

```json
// Request Body:
{
  "no_rawat": "2026/06/23/0004",
  "kd_poli": "INT"
}

// Response:
{
  "status": "success",
  "message": "Pasien berhasil dipanggil",
  "data": { ... }
}
```

### Kode Poliklinik yang Didukung

| Kode | Nama Poliklinik |
|---|---|
| `006` | KLINIK GERIATRI |
| `040` | KLINIK TUMBANG |
| `ANA` | KLINIK ANAK |
| `BED` | KLINIK BEDAH |
| `GIG` | KLINIK GIGI UMUM |
| `INT` | KLINIK PENYAKIT DALAM |
| `JAN` | KLINIK JANTUNG |
| `JIW` | KLINIK JIWA |
| `MAT` | KLINIK MATA |
| `OBG` | KLINIK OBSTETRI/GYN. |
| `PAR` | KLINIK PARU |
| `SAR` | KLINIK SARAF |
| `THT` | KLINIK THT |
| `U0016` | KLINIK UMUM / MCU |

---

## 🔒 Keamanan

| Aspek | Implementasi |
|---|---|
| **Autentikasi API** | Semua endpoint dilindungi header `X-API-Token` |
| **CORS** | Hanya origin yang diizinkan dapat mengakses API |
| **Kredensial DB** | Disimpan hanya di file `.env` lokal, tidak masuk Git |
| **Redis** | Hanya dapat diakses dari dalam jaringan Docker internal |
| **MariaDB** | Port tidak dibuka ke luar (internal Docker only) |
| **Repo GitHub** | Private — kode tidak bisa diakses publik |
| **Token API** | Disarankan menggunakan 256-bit random token |

---

## 🏢 Informasi Proyek

| Item | Detail |
|---|---|
| **Instansi** | RSUD Datu Sanggul, Tabalong, Kalimantan Selatan |
| **Versi** | 1.0.0 |
| **Lisensi** | Private / Internal Use |
| **Dikembangkan** | Juni 2026 |

---

<div align="center">

Dikembangkan untuk **RSUD Datu Sanggul** 🏥

</div>
