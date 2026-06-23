'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  getQueue,
  callPatient,
  finishCall,
  finishExamine,
  resetQueue
} from '@/lib/api';
import { QueueData, QueueItem } from '@/lib/types';
import { useWebSocket } from '@/hooks/useWebSocket';

function PetugasControlContent() {
  const searchParams = useSearchParams();
  const kdPoli = searchParams.get('kd_poli') || 'U001';

  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);

  // Fetch data antrian awal
  const fetchData = async () => {
    try {
      const data = await getQueue(kdPoli);
      setQueueData(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Gagal memuat data antrian dari server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [kdPoli]);

  // WebSocket Integration
  const wsUrl = `ws://localhost:8080/ws?kd_poli=${kdPoli}`;
  useWebSocket({
    url: wsUrl,
    onMessage: (event) => {
      if (event.event === 'queue_updated') {
        fetchData(); // Sync data seketika saat ada perubahan dari klien lain
      }
    },
    onConnect: () => setConnected(true),
    onDisconnect: () => setConnected(false),
  });

  const handleAction = async (actionFn: any, noRawat: string, actionName: string) => {
    setActionLoading(noRawat);
    try {
      await actionFn({ no_rawat: noRawat, kd_poli: kdPoli });
      await fetchData(); // Refresh local state
    } catch (err: any) {
      alert(err.message || `Gagal melakukan aksi ${actionName}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0A0F1E]">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-t-transparent border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400 font-medium font-sans">Memuat Dashboard Petugas...</p>
        </div>
      </div>
    );
  }

  if (error || !queueData) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0A0F1E]">
        <div className="text-center glass-card p-8 rounded-2xl max-w-md">
          <p className="text-rose-500 font-bold mb-4">⚠️ ERROR</p>
          <p className="text-gray-300 font-medium mb-6">{error || 'Data tidak ditemukan'}</p>
          <button
            onClick={fetchData}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl transition-all"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  const renderPatientCard = (item: QueueItem, index: number, statusColor: string, actions: React.ReactNode) => {
    const isProcessing = actionLoading === item.no_rawat;
    return (
      <div
        key={item.id}
        className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 flex flex-col gap-3 transition-all hover:border-gray-700 relative overflow-hidden shrink-0"
      >
        {isProcessing && (
          <div className="absolute inset-0 bg-gray-950/70 z-10 flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent border-blue-500"></div>
          </div>
        )}
        <div className="flex justify-between items-start">
          <div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${statusColor}`}>
              {item.no_reg}
            </span>
            <h4 className="font-bold text-white mt-2 font-sans line-clamp-1">{item.nm_pasien}</h4>
            <p className="text-lg text-gray-400 mt-0.5">RM: {item.no_rkm_medis}</p>
            <p className="text-lg text-gray-400 mt-0.5">Nomor Rawat : {item.no_rawat}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-gray-800">
          {actions}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden p-6 gap-6 bg-[#0A0F1E] text-white">
      {/* Header */}
      <header className="flex justify-between items-center glass-card px-8 py-4 rounded-2xl">
        <div className="flex items-center gap-4">
          <img src="/logo_rsudds.png" alt="Logo RSUD Datu Sanggul" className="h-12 w-12 object-contain" />
          <div>
            <h1 className="text-xl font-black tracking-tight text-white font-heading">
              Panel Kontrol Petugas — RSUD Datu Sanggul
            </h1>
            <p className="text-xs text-gray-400 uppercase tracking-wider mt-0.5">
              Poliklinik: {queueData.nm_poli} | Kode: {queueData.kd_poli}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
            <span className="text-xs text-gray-400 font-medium">
              {connected ? 'WS Connected' : 'WS Disconnected'}
            </span>
          </div>
          <button
            onClick={fetchData}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold py-1.5 px-3 rounded-lg border border-gray-700 transition-all"
          >
            🔄 Refresh
          </button>
        </div>
      </header>

      {/* Summary Bar */}

      {/* Kanban Board */}
      <main className="grid grid-cols-4 gap-6 flex-1 min-h-0">

        {/* Kolom MENUNGGU */}
        <div className="glass-card rounded-2xl p-4 flex flex-col min-h-0">
          <div className="flex justify-between items-center pb-3 mb-4 border-b border-gray-800">
            <h3 className="font-extrabold text-amber-500 uppercase tracking-wider text-lg">Menunggu</h3>
            <span className="bg-amber-950/50 text-amber-400 text-lg font-black px-3 py-1 rounded-lg border border-amber-900/35">
              {queueData.waiting.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-2 pr-1">
            {queueData.waiting.map((item, idx) =>
              renderPatientCard(item, idx, "bg-amber-500/20 text-amber-400 border border-amber-500/30", (
                <button
                  onClick={() => handleAction(callPatient, item.no_rawat, 'Panggil')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-3 rounded-lg transition-all"
                >
                  🔊 Panggil Pasien
                </button>
              ))
            )}
            {queueData.waiting.length === 0 && (
              <div className="text-center text-xs text-gray-500 py-8">Tidak ada pasien menunggu</div>
            )}
          </div>
        </div>

        {/* Kolom DIPANGGIL */}
        <div className="glass-card rounded-2xl p-4 flex flex-col min-h-0">
          <div className="flex justify-between items-center pb-3 mb-4 border-b border-gray-800">
            <h3 className="font-extrabold text-blue-400 uppercase tracking-wider text-lg">Dipanggil</h3>
            <span className="bg-blue-950/50 text-blue-400 text-lg font-black px-3 py-1 rounded-lg border border-blue-900/35">
              {queueData.called.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-3 pr-1">
            {queueData.called.map((item, idx) =>
              renderPatientCard(item, idx, "bg-blue-500/20 text-blue-400 border border-blue-500/30", (
                <>
                  <button
                    onClick={() => handleAction(callPatient, item.no_rawat, 'Panggil')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-3 rounded-lg transition-all"
                  >
                    🔊 Panggil Pasien
                  </button>
                  <button
                    onClick={() => handleAction(finishCall, item.no_rawat, 'Mulai Periksa')}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-2.5 rounded-lg transition-all"
                  >
                    🩺 Mulai Periksa
                  </button>
                  <button
                    onClick={() => handleAction(resetQueue, item.no_rawat, 'Kembalikan')}
                    className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs py-2 px-2.5 rounded-lg transition-all border border-gray-700"
                  >
                    ↩️ Reset
                  </button>
                </>
              ))
            )}
            {queueData.called.length === 0 && (
              <div className="text-center text-xs text-gray-500 py-8">Tidak ada pasien dipanggil</div>
            )}
          </div>
        </div>

        {/* Kolom DIPERIKSA */}
        <div className="glass-card rounded-2xl p-4 flex flex-col min-h-0">
          <div className="flex justify-between items-center pb-3 mb-4 border-b border-gray-800">
            <h3 className="font-extrabold text-emerald-400 uppercase tracking-wider text-lg">Diperiksa</h3>
            <span className="bg-emerald-950/50 text-emerald-400 text-lg font-black px-3 py-1 rounded-lg border border-emerald-900/35">
              {queueData.examining.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-3 pr-1">
            {queueData.examining.map((item, idx) =>
              renderPatientCard(item, idx, "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30", (
                <>
                  <button
                    onClick={() => handleAction(finishExamine, item.no_rawat, 'Selesai Periksa')}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold text-xs py-2 px-2.5 rounded-lg transition-all"
                  >
                    ✅ Selesai Periksa
                  </button>
                  <button
                    onClick={() => handleAction(resetQueue, item.no_rawat, 'Kembalikan')}
                    className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs py-2 px-2.5 rounded-lg transition-all border border-gray-700"
                  >
                    ↩️ Reset
                  </button>
                </>
              ))
            )}
            {queueData.examining.length === 0 && (
              <div className="text-center text-xs text-gray-500 py-8">Tidak ada pasien diperiksa</div>
            )}
          </div>
        </div>

        {/* Kolom SELESAI */}
        <div className="glass-card rounded-2xl p-4 flex flex-col min-h-0">
          <div className="flex justify-between items-center pb-3 mb-4 border-b border-gray-800">
            <h3 className="font-extrabold text-gray-400 uppercase tracking-wider text-lg">Selesai</h3>
            <span className="bg-gray-900/50 text-gray-400 text-lg font-black px-3 py-1 rounded-lg border border-gray-800/35">
              {queueData.finished.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-3 pr-1">
            {queueData.finished.map((item, idx) =>
              renderPatientCard(item, idx, "bg-gray-500/20 text-gray-400 border border-gray-500/30", (
                <button
                  onClick={() => handleAction(resetQueue, item.no_rawat, 'Reset')}
                  className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs py-2 px-3 rounded-lg transition-all border border-gray-700"
                >
                  ↩️ Kembalikan ke Menunggu
                </button>
              ))
            )}
            {queueData.finished.length === 0 && (
              <div className="text-center text-xs text-gray-500 py-8">Belum ada pasien selesai</div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}

export default function PetugasControlPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#0A0F1E]">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-t-transparent border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400 font-medium font-sans">Memuat...</p>
        </div>
      </div>
    }>
      <PetugasControlContent />
    </Suspense>
  );
}
