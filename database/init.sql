CREATE DATABASE IF NOT EXISTS `anjungan_db`;
USE `anjungan_db`;

CREATE TABLE IF NOT EXISTS `queue_status` (
  `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `no_rawat`      VARCHAR(17)     NOT NULL COMMENT 'Ref ke reg_periksa.no_rawat',
  `no_reg`        VARCHAR(8)      NOT NULL COMMENT 'Nomor antrian dari SIMRS',
  `nm_pasien`     VARCHAR(100)    NOT NULL,
  `no_rkm_medis`  VARCHAR(15)     NOT NULL,
  `kd_poli`       CHAR(5)         NOT NULL,
  `kd_dokter`     VARCHAR(20)     NULL DEFAULT NULL,
  `tgl_registrasi` DATE           NOT NULL,
  `jam_reg`       TIME            NULL DEFAULT NULL,
  `status`        ENUM('MENUNGGU','DIPANGGIL','DIPERIKSA','SELESAI') NOT NULL DEFAULT 'MENUNGGU',
  `called_at`     DATETIME        NULL DEFAULT NULL,
  `examined_at`   DATETIME        NULL DEFAULT NULL,
  `finished_at`   DATETIME        NULL DEFAULT NULL,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_no_rawat_tgl` (`no_rawat`, `tgl_registrasi`),
  INDEX `idx_kd_poli_tgl`  (`kd_poli`, `tgl_registrasi`),
  INDEX `idx_status`       (`status`),
  INDEX `idx_no_reg`       (`no_reg`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
