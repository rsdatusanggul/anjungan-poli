package model

// Poliklinik merepresentasikan tabel poliklinik di database SIMRS (rsds_db)
type Poliklinik struct {
	KdPoli     string  `json:"kd_poli"     gorm:"column:kd_poli;primaryKey"`
	NmPoli     string  `json:"nm_poli"     gorm:"column:nm_poli"`
	Registrasi float64 `json:"registrasi"  gorm:"column:registrasi"`
	RegLama    float64 `json:"registrasilama" gorm:"column:registrasilama"`
	Status     string  `json:"status"      gorm:"column:status;type:enum('0','1')"`
}

func (Poliklinik) TableName() string {
	return "poliklinik"
}
