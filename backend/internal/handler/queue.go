package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"anjungan-poli/backend/internal/model"
	"anjungan-poli/backend/internal/websocket"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type QueueHandler struct {
	simrsDB    *gorm.DB
	anjunganDB *gorm.DB
	rdb        *redis.Client
	hub        *websocket.Hub
}

func NewQueueHandler(simrsDB, anjunganDB *gorm.DB, rdb *redis.Client, hub *websocket.Hub) *QueueHandler {
	return &QueueHandler{
		simrsDB:    simrsDB,
		anjunganDB: anjunganDB,
		rdb:        rdb,
		hub:        hub,
	}
}

// GetQueue mengambil data antrian gabungan dari SIMRS dan status lokal
func (h *QueueHandler) GetQueue(c *gin.Context) {
	kdPoli := c.Query("kd_poli")
	if kdPoli == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "kd_poli parameter is required"})
		return
	}

	tglStr := c.Query("tgl_registrasi")
	var tgl time.Time
	var err error
	if tglStr != "" {
		tgl, err = time.Parse("2006-01-02", tglStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid date format. Use YYYY-MM-DD"})
			return
		}
	} else {
		tgl = time.Now()
	}

	tglFormatted := tgl.Format("2006-01-02")
	redisKey := "anjungan:" + kdPoli + ":" + tglFormatted + ":state"

	// Coba ambil dari Redis cache terlebih dahulu
	if h.rdb != nil {
		if cachedData, err := h.rdb.Get(c.Request.Context(), redisKey).Result(); err == nil && cachedData != "" {
			c.Data(http.StatusOK, "application/json", []byte(cachedData))
			return
		}
	}

	// 1. Ambil data dari SIMRS (rsds_db)
	var regList []model.RegPeriksa
	var nmPoli = getPoliklinikName(kdPoli)

	if h.simrsDB != nil {
		err = h.simrsDB.Raw(`
			SELECT 
				rp.no_rawat, 
				rp.no_reg, 
				rp.tgl_registrasi, 
				rp.jam_reg, 
				rp.kd_poli, 
				pl.nm_poli, 
				rp.no_rkm_medis, 
				ps.nm_pasien, 
				rp.kd_dokter, 
				dk.nm_dokter, 
				rp.stts, 
				rp.status_lanjut, 
				rp.status_bayar
			FROM reg_periksa rp
			LEFT JOIN poliklinik pl ON rp.kd_poli = pl.kd_poli
			LEFT JOIN pasien ps     ON rp.no_rkm_medis = ps.no_rkm_medis
			LEFT JOIN dokter dk     ON rp.kd_dokter = dk.kd_dokter
			WHERE rp.tgl_registrasi = ? 
				AND rp.status_lanjut = 'Ralan' 
				AND rp.kd_poli = ? 
				AND rp.stts NOT IN ('Batal')
			ORDER BY rp.no_reg ASC
		`, tglFormatted, kdPoli).Scan(&regList).Error

		if err != nil {
			log.Printf("Gagal membaca database SIMRS: %v. Menggunakan mode fallback lokal.", err)
		} else if len(regList) > 0 && regList[0].NmPoli != "" {
			nmPoli = regList[0].NmPoli
		}
	}

	// Fallback Mode / Simulation Mode jika database SIMRS kosong/tidak terkoneksi
	if len(regList) == 0 {
		log.Println("Mengaktifkan simulasi data antrian karena data SIMRS kosong.")
		regList = getDummyRegistrations(kdPoli, tglFormatted)
	}

	// 2. Sinkronisasikan dengan anjungan_db lokal
	for _, reg := range regList {
		var local model.QueueStatus
		err = h.anjunganDB.Where("no_rawat = ? AND tgl_registrasi = ?", reg.NoRawat, tglFormatted).First(&local).Error
		if err == gorm.ErrRecordNotFound {
			// Sisipkan data baru dengan status MENUNGGU
			newStatus := model.QueueStatus{
				NoRawat:       reg.NoRawat,
				NoReg:         reg.NoReg,
				NmPasien:      reg.NmPasien,
				NoRkmMedis:    reg.NoRkmMedis,
				KdPoli:        reg.KdPoli,
				KdDokter:      &reg.KdDokter,
				TglRegistrasi: tgl,
				JamReg:        &reg.JamReg,
				Status:        "MENUNGGU",
			}
			h.anjunganDB.Create(&newStatus)
		}
	}

	// 3. Ambil data status lokal yang telah disinkronisasikan
	var localStatuses []model.QueueStatus
	h.anjunganDB.Where("kd_poli = ? AND tgl_registrasi = ?", kdPoli, tglFormatted).Order("no_reg ASC").Find(&localStatuses)

	// 4. Klasifikasikan status antrian
	waiting := make([]model.QueueStatus, 0)
	called := make([]model.QueueStatus, 0)
	examining := make([]model.QueueStatus, 0)
	finished := make([]model.QueueStatus, 0)

	var currentCalling *model.QueueStatus
	var currentExamining *model.QueueStatus

	for i := range localStatuses {
		q := localStatuses[i]
		switch q.Status {
		case "MENUNGGU":
			waiting = append(waiting, q)
		case "DIPANGGIL":
			called = append(called, q)
			if currentCalling == nil || (q.CalledAt != nil && currentCalling.CalledAt != nil && q.CalledAt.After(*currentCalling.CalledAt)) {
				currentCalling = &localStatuses[i]
			}
		case "DIPERIKSA":
			examining = append(examining, q)
			if currentExamining == nil || (q.ExaminedAt != nil && currentExamining.ExaminedAt != nil && q.ExaminedAt.After(*currentExamining.ExaminedAt)) {
				currentExamining = &localStatuses[i]
			}
		case "SELESAI":
			finished = append(finished, q)
		}
	}

	var nextQueue *model.QueueStatus
	if len(waiting) > 0 {
		nextQueue = &waiting[0]
	}

	// Format response
	responseMap := gin.H{
		"status": "success",
		"data": gin.H{
			"kd_poli":           kdPoli,
			"nm_poli":           nmPoli,
			"tgl_registrasi":    tglFormatted,
			"current_calling":   currentCalling,
			"current_examining": currentExamining,
			"next_queue":        nextQueue,
			"waiting":           waiting,
			"called":            called,
			"examining":         examining,
			"finished":          finished,
			"summary": gin.H{
				"total_menunggu":  len(waiting),
				"total_dipanggil": len(called),
				"total_diperiksa": len(examining),
				"total_selesai":   len(finished),
			},
		},
	}

	// Simpan ke Redis cache (TTL 5 menit)
	if h.rdb != nil {
		if jsonBytes, err := json.Marshal(responseMap); err == nil {
			h.rdb.Set(c.Request.Context(), redisKey, string(jsonBytes), 5*time.Minute)
		}
	}

	c.JSON(http.StatusOK, responseMap)
}

// CallPatient memanggil pasien (MENUNGGU/DIPERIKSA/SELESAI -> DIPANGGIL)
func (h *QueueHandler) CallPatient(c *gin.Context) {
	var req struct {
		NoRawat string `json:"no_rawat" binding:"required"`
		KdPoli  string `json:"kd_poli" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
		return
	}

	now := time.Now()
	tglFormatted := now.Format("2006-01-02")

	var status model.QueueStatus
	err := h.anjunganDB.Where("no_rawat = ? AND tgl_registrasi = ?", req.NoRawat, tglFormatted).First(&status).Error
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Nomor antrian tidak ditemukan"})
		return
	}

	// Update status
	status.Status = "DIPANGGIL"
	status.CalledAt = &now
	h.anjunganDB.Save(&status)

	// Invalidate cache
	if h.rdb != nil {
		redisKey := "anjungan:" + req.KdPoli + ":" + tglFormatted + ":state"
		h.rdb.Del(c.Request.Context(), redisKey)
	}

	// Broadcast update
	h.notifyQueueUpdate(req.KdPoli)

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Pasien berhasil dipanggil", "data": status})
}

// FinishCall mengubah status DIPANGGIL -> DIPERIKSA
func (h *QueueHandler) FinishCall(c *gin.Context) {
	var req struct {
		NoRawat string `json:"no_rawat" binding:"required"`
		KdPoli  string `json:"kd_poli" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
		return
	}

	now := time.Now()
	tglFormatted := now.Format("2006-01-02")

	var status model.QueueStatus
	err := h.anjunganDB.Where("no_rawat = ? AND tgl_registrasi = ?", req.NoRawat, tglFormatted).First(&status).Error
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Nomor antrian tidak ditemukan"})
		return
	}

	status.Status = "DIPERIKSA"
	status.ExaminedAt = &now
	h.anjunganDB.Save(&status)

	// Invalidate cache
	if h.rdb != nil {
		redisKey := "anjungan:" + req.KdPoli + ":" + tglFormatted + ":state"
		h.rdb.Del(c.Request.Context(), redisKey)
	}

	h.notifyQueueUpdate(req.KdPoli)

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Pelayanan dipanggil selesai, pasien diperiksa", "data": status})
}

// FinishExamine mengubah status DIPERIKSA -> SELESAI
func (h *QueueHandler) FinishExamine(c *gin.Context) {
	var req struct {
		NoRawat string `json:"no_rawat" binding:"required"`
		KdPoli  string `json:"kd_poli" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
		return
	}

	now := time.Now()
	tglFormatted := now.Format("2006-01-02")

	var status model.QueueStatus
	err := h.anjunganDB.Where("no_rawat = ? AND tgl_registrasi = ?", req.NoRawat, tglFormatted).First(&status).Error
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Nomor antrian tidak ditemukan"})
		return
	}

	status.Status = "SELESAI"
	status.FinishedAt = &now
	h.anjunganDB.Save(&status)

	// Invalidate cache
	if h.rdb != nil {
		redisKey := "anjungan:" + req.KdPoli + ":" + tglFormatted + ":state"
		h.rdb.Del(c.Request.Context(), redisKey)
	}

	h.notifyQueueUpdate(req.KdPoli)

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Pelayanan selesai", "data": status})
}

// ResetQueue mengembalikan status apa saja kembali ke MENUNGGU
func (h *QueueHandler) ResetQueue(c *gin.Context) {
	var req struct {
		NoRawat string `json:"no_rawat" binding:"required"`
		KdPoli  string `json:"kd_poli" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
		return
	}

	now := time.Now()
	tglFormatted := now.Format("2006-01-02")

	var status model.QueueStatus
	err := h.anjunganDB.Where("no_rawat = ? AND tgl_registrasi = ?", req.NoRawat, tglFormatted).First(&status).Error
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Nomor antrian tidak ditemukan"})
		return
	}

	status.Status = "MENUNGGU"
	status.CalledAt = nil
	status.ExaminedAt = nil
	status.FinishedAt = nil
	h.anjunganDB.Save(&status)

	// Invalidate cache
	if h.rdb != nil {
		redisKey := "anjungan:" + req.KdPoli + ":" + tglFormatted + ":state"
		h.rdb.Del(c.Request.Context(), redisKey)
	}

	h.notifyQueueUpdate(req.KdPoli)

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Status antrian berhasil di-reset ke menunggu", "data": status})
}

// notifyQueueUpdate memicu broadcast real-time ke semua display
func (h *QueueHandler) notifyQueueUpdate(kdPoli string) {
	// Pemicu websocket broadcast ke client
	// Kita bisa melakukan marshalling data baru di sini atau sekedar mengirim sinyal refresh
	h.hub.BroadcastQueueUpdate(kdPoli, map[string]string{
		"action": "refresh",
	})
}

// getDummyRegistrations menghasilkan data dummy registrasi untuk testing lokal tanpa SIMRS DB
func getDummyRegistrations(kdPoli, tgl string) []model.RegPeriksa {
	nmPoli := getPoliklinikName(kdPoli)
	return []model.RegPeriksa{
		{NoReg: "A001", NoRawat: "2026/06/14/0001", TglRegistrasi: tgl, JamReg: "08:00:00", KdPoli: kdPoli, NmPoli: nmPoli, NoRkmMedis: "000101", NmPasien: "AHMAD FAUZI", KdDokter: "DR001", NmDokter: "dr. Sp. Umum"},
		{NoReg: "A002", NoRawat: "2026/06/14/0002", TglRegistrasi: tgl, JamReg: "08:10:00", KdPoli: kdPoli, NmPoli: nmPoli, NoRkmMedis: "000102", NmPasien: "SITI AMINAH", KdDokter: "DR001", NmDokter: "dr. Sp. Umum"},
		{NoReg: "A003", NoRawat: "2026/06/14/0003", TglRegistrasi: tgl, JamReg: "08:15:00", KdPoli: kdPoli, NmPoli: nmPoli, NoRkmMedis: "000103", NmPasien: "BUDI SANTOSO", KdDokter: "DR001", NmDokter: "dr. Sp. Umum"},
		{NoReg: "A004", NoRawat: "2026/06/14/0004", TglRegistrasi: tgl, JamReg: "08:20:00", KdPoli: kdPoli, NmPoli: nmPoli, NoRkmMedis: "000104", NmPasien: "DEWI LESTARI", KdDokter: "DR001", NmDokter: "dr. Sp. Umum"},
		{NoReg: "A005", NoRawat: "2026/06/14/0005", TglRegistrasi: tgl, JamReg: "08:25:00", KdPoli: kdPoli, NmPoli: nmPoli, NoRkmMedis: "000105", NmPasien: "HENDRA WIJAYA", KdDokter: "DR001", NmDokter: "dr. Sp. Umum"},
		{NoReg: "A006", NoRawat: "2026/06/14/0006", TglRegistrasi: tgl, JamReg: "08:30:00", KdPoli: kdPoli, NmPoli: nmPoli, NoRkmMedis: "000106", NmPasien: "RINA MARLIANA", KdDokter: "DR001", NmDokter: "dr. Sp. Umum"},
		{NoReg: "A007", NoRawat: "2026/06/14/0007", TglRegistrasi: tgl, JamReg: "08:35:00", KdPoli: kdPoli, NmPoli: nmPoli, NoRkmMedis: "000107", NmPasien: "JOKO SUSILO", KdDokter: "DR001", NmDokter: "dr. Sp. Umum"},
		{NoReg: "A008", NoRawat: "2026/06/14/0008", TglRegistrasi: tgl, JamReg: "08:40:00", KdPoli: kdPoli, NmPoli: nmPoli, NoRkmMedis: "000108", NmPasien: "YULI ANGGRAENI", KdDokter: "DR001", NmDokter: "dr. Sp. Umum"},
		{NoReg: "A009", NoRawat: "2026/06/14/0009", TglRegistrasi: tgl, JamReg: "08:45:00", KdPoli: kdPoli, NmPoli: nmPoli, NoRkmMedis: "000109", NmPasien: "BAMBANG KURNIAWAN", KdDokter: "DR001", NmDokter: "dr. Sp. Umum"},
	}
}

// getPoliklinikName mencocokkan kode poli dengan nama poliklinik fallback
func getPoliklinikName(kdPoli string) string {
	names := map[string]string{
		"006":   "KLINIK GERIATRI",
		"040":   "KLINIK TUMBANG",
		"ANA":   "KLINIK ANAK",
		"BED":   "KLINIK BEDAH",
		"GIG":   "KLINIK GIGI UMUM",
		"INT":   "KLINIK PENYAKIT DALAM",
		"JAN":   "KLINIK JANTUNG",
		"JIW":   "KLINIK JIWA",
		"MAT":   "KLINIK MATA",
		"OBG":   "KLINIK OBSTETRI/GYN.",
		"PAR":   "KLINIK PARU",
		"SAR":   "KLINIK SARAF",
		"THT":   "KLINIK THT",
		"U0016": "KLINIK UMUM / MCU",
	}
	if name, ok := names[kdPoli]; ok {
		return name
	}
	return "POLIKLINIK UMUM"
}

// GetPoliklinik mengambil daftar poliklinik aktif
func (h *QueueHandler) GetPoliklinik(c *gin.Context) {
	var list []model.Poliklinik

	if h.simrsDB != nil {
		err := h.simrsDB.Where("status = ?", "1").Order("nm_poli ASC").Find(&list).Error
		if err != nil {
			log.Printf("Gagal mengambil poliklinik dari SIMRS: %v. Menggunakan fallback lokal.", err)
		}
	}

	// Fallback jika tidak ada data dari SIMRS
	if len(list) == 0 {
		list = []model.Poliklinik{
			{KdPoli: "006", NmPoli: "KLINIK GERIATRI", Status: "1"},
			{KdPoli: "040", NmPoli: "KLINIK TUMBANG", Status: "1"},
			{KdPoli: "ANA", NmPoli: "KLINIK ANAK", Status: "1"},
			{KdPoli: "BED", NmPoli: "KLINIK BEDAH", Status: "1"},
			{KdPoli: "GIG", NmPoli: "KLINIK GIGI UMUM", Status: "1"},
			{KdPoli: "INT", NmPoli: "KLINIK PENYAKIT DALAM", Status: "1"},
			{KdPoli: "JAN", NmPoli: "KLINIK JANTUNG", Status: "1"},
			{KdPoli: "JIW", NmPoli: "KLINIK JIWA", Status: "1"},
			{KdPoli: "MAT", NmPoli: "KLINIK MATA", Status: "1"},
			{KdPoli: "OBG", NmPoli: "KLINIK OBSTETRI/GYN.", Status: "1"},
			{KdPoli: "PAR", NmPoli: "KLINIK PARU", Status: "1"},
			{KdPoli: "SAR", NmPoli: "KLINIK SARAF", Status: "1"},
			{KdPoli: "THT", NmPoli: "KLINIK THT", Status: "1"},
			{KdPoli: "U0016", NmPoli: "KLINIK UMUM / MCU", Status: "1"},
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   list,
	})
}
