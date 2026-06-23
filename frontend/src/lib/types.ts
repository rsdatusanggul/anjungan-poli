export type QueueStatusType = 'MENUNGGU' | 'DIPANGGIL' | 'DIPERIKSA' | 'SELESAI';

export interface QueueItem {
  id: number;
  no_rawat: string;
  no_reg: string;
  nm_pasien: string;
  no_rkm_medis: string;
  kd_poli: string;
  kd_dokter: string | null;
  tgl_registrasi: string;
  jam_reg: string | null;
  status: QueueStatusType;
  called_at: string | null;
  examined_at: string | null;
  finished_at: string | null;
}

export interface QueueSummary {
  total_menunggu: number;
  total_dipanggil: number;
  total_diperiksa: number;
  total_selesai: number;
}

export interface QueueData {
  kd_poli: string;
  nm_poli: string;
  tgl_registrasi: string;
  summary: QueueSummary;
  current_calling: QueueItem | null;
  current_examining: QueueItem | null;
  next_queue: QueueItem | null;
  waiting: QueueItem[];
  called: QueueItem[];
  examining: QueueItem[];
  finished: QueueItem[];
}

export interface WebSocketEvent {
  event: 'queue_updated' | 'ping';
  data: {
    kd_poli: string;
    payload: {
      action: string;
    };
  };
}

export interface Poliklinik {
  kd_poli: string;
  nm_poli: string;
  status: string;
}
