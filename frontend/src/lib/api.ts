import { QueueData, Poliklinik } from './types';

const API_URL = '/api';

const headers = {
  'Content-Type': 'application/json',
};

export interface QueueActionPayload {
  no_rawat: string;
  kd_poli: string;
}

// Ambil data antrian berdasarkan kd_poli dan tgl_registrasi
export async function getQueue(kdPoli: string, tglRegistrasi?: string): Promise<QueueData> {
  const params = new URLSearchParams({ kd_poli: kdPoli });
  if (tglRegistrasi) {
    params.append('tgl_registrasi', tglRegistrasi);
  }
  
  const res = await fetch(`${API_URL}/queue?${params}`, { 
    headers,
    cache: 'no-store'
  });
  
  if (!res.ok) {
    throw new Error('Gagal mengambil data antrian');
  }
  
  const json = await res.json();
  return json.data;
}

// Panggil pasien (MENUNGGU/DIPERIKSA/SELESAI -> DIPANGGIL)
export async function callPatient(payload: QueueActionPayload) {
  const res = await fetch(`${API_URL}/queue/call`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Gagal memanggil pasien');
  }
  return res.json();
}

// Selesaikan panggilan (DIPANGGIL -> DIPERIKSA)
export async function finishCall(payload: QueueActionPayload) {
  const res = await fetch(`${API_URL}/queue/finish-call`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Gagal menyelesaikan pemanggilan');
  }
  return res.json();
}

// Selesaikan pemeriksaan (DIPERIKSA -> SELESAI)
export async function finishExamine(payload: QueueActionPayload) {
  const res = await fetch(`${API_URL}/queue/finish-examine`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Gagal menyelesaikan pemeriksaan');
  }
  return res.json();
}

// Reset status antrian pasien ke MENUNGGU
export async function resetQueue(payload: QueueActionPayload) {
  const res = await fetch(`${API_URL}/queue/reset`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Gagal mereset antrian');
  }
  return res.json();
}

// Ambil daftar poliklinik aktif dari backend
export async function getPoliklinik(): Promise<Poliklinik[]> {
  const res = await fetch(`${API_URL}/poliklinik`, {
    headers,
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('Gagal mengambil daftar poliklinik');
  }
  const json = await res.json();
  return json.data;
}
