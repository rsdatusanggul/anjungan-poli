package model

import "time"

// QueueStatus adalah model untuk tabel queue_status di anjungan_db (read/write)
type QueueStatus struct {
	ID            uint       `json:"id"              gorm:"primaryKey;autoIncrement"`
	NoRawat       string     `json:"no_rawat"        gorm:"column:no_rawat;size:17;not null"`        // PK dari reg_periksa SIMRS
	NoReg         string     `json:"no_reg"          gorm:"column:no_reg;size:8;not null"`           // Nomor antrian display
	NmPasien      string     `json:"nm_pasien"       gorm:"column:nm_pasien;size:100;not null"`
	NoRkmMedis    string     `json:"no_rkm_medis"    gorm:"column:no_rkm_medis;size:15;not null"`
	KdPoli        string     `json:"kd_poli"         gorm:"column:kd_poli;size:5;not null"`
	KdDokter      *string    `json:"kd_dokter"       gorm:"column:kd_dokter;size:20"`
	TglRegistrasi time.Time  `json:"tgl_registrasi"  gorm:"column:tgl_registrasi;not null"`
	JamReg        *string    `json:"jam_reg"         gorm:"column:jam_reg"`                          // TIME as string "08:30:00"
	Status        string     `json:"status"          gorm:"column:status;type:enum('MENUNGGU','DIPANGGIL','DIPERIKSA','SELESAI');default:'MENUNGGU'"`
	CalledAt      *time.Time `json:"called_at"       gorm:"column:called_at"`
	ExaminedAt    *time.Time `json:"examined_at"     gorm:"column:examined_at"`
	FinishedAt    *time.Time `json:"finished_at"     gorm:"column:finished_at"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

func (QueueStatus) TableName() string {
	return "queue_status" // di anjungan_db
}

// RegPeriksa adalah model untuk membaca data dari SIMRS rsds_db (read-only)
// Tabel: reg_periksa @ 192.168.11.50:3306/rsds_db
type RegPeriksa struct {
	NoReg         string `json:"no_reg"          gorm:"column:no_reg"`          // Nomor antrian
	NoRawat       string `json:"no_rawat"         gorm:"column:no_rawat;primaryKey"` // PK
	TglRegistrasi string `json:"tgl_registrasi"  gorm:"column:tgl_registrasi"`
	JamReg        string `json:"jam_reg"          gorm:"column:jam_reg"`
	KdDokter      string `json:"kd_dokter"        gorm:"column:kd_dokter"`
	NoRkmMedis    string `json:"no_rkm_medis"    gorm:"column:no_rkm_medis"`
	KdPoli        string `json:"kd_poli"          gorm:"column:kd_poli"`
	Stts          string `json:"stts"             gorm:"column:stts"`
	StatusLanjut  string `json:"status_lanjut"   gorm:"column:status_lanjut"`
	StatusBayar   string `json:"status_bayar"    gorm:"column:status_bayar"`
	// Join fields (bukan kolom asli, dari SELECT AS)
	NmPasien      string `json:"nm_pasien"        gorm:"column:nm_pasien;->"`
	NmPoli        string `json:"nm_poli"          gorm:"column:nm_poli;->"`
	NmDokter      string `json:"nm_dokter"        gorm:"column:nm_dokter;->"`
}

func (RegPeriksa) TableName() string {
	return "reg_periksa" // di rsds_db SIMRS, hanya dibaca
}
