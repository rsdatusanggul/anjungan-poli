'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getQueue } from '@/lib/api';
import { QueueData, QueueItem } from '@/lib/types';
import { useWebSocket } from '@/hooks/useWebSocket';
import { playChime, speakQueueNumber } from '@/lib/audio';

function PasienDisplayContent() {
  const searchParams = useSearchParams();
  const kdPoli = searchParams.get('kd_poli') || 'U001';

  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);

  const prevCallingRef = useRef<QueueItem | null>(null);

  // Fetch data antrian awal
  const fetchData = async () => {
    try {
      const data = await getQueue(kdPoli);
      setQueueData(data);
      setError(null);

      // Cek apakah ada nomor dipanggil baru untuk dibunyikan suara
      if (data.current_calling) {
        const prevCalling = prevCallingRef.current;
        if (!prevCalling || prevCalling.no_rawat !== data.current_calling.no_rawat || prevCalling.status !== data.current_calling.status || prevCalling.called_at !== data.current_calling.called_at) {
          prevCallingRef.current = data.current_calling;

          // Trigger Chime & Text-To-Speech
          playChime().then(() => {
            if (data.current_calling) {
              speakQueueNumber(data.current_calling.no_reg, data.current_calling.nm_pasien, data.nm_poli);
            }
          });
        }
      } else {
        prevCallingRef.current = null;
      }
    } catch (err) {
      console.error(err);
      setError('Gagal memuat data antrian. Mencoba kembali...');
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll setiap 10 detik sebagai backup

    // Update Jam & Tanggal secara Live
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDate(now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, [kdPoli]);

  // Pemicu Fullscreen Otomatis pada klik pertama
  useEffect(() => {
    const handleFullscreen = () => {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(err => {
          console.warn('[Fullscreen API] Gagal mengaktifkan layar penuh:', err);
        });
      }
    };
    document.addEventListener('click', handleFullscreen, { once: true });
    return () => {
      document.removeEventListener('click', handleFullscreen);
    };
  }, []);

  // Fitur Proteksi Kiosk Mode (Mencegah Keluar / Refresh / Klik Kanan)
  useEffect(() => {
    const lockKeyboard = async () => {
      if (typeof window !== 'undefined' && 'keyboard' in navigator && (navigator.keyboard as any).lock) {
        try {
          await (navigator.keyboard as any).lock(['Escape', 'F11', 'Tab']);
          console.log('[Kiosk] Keyboard berhasil dikunci.');
        } catch (err) {
          console.warn('[Kiosk] Gagal mengunci keyboard:', err);
        }
      }
    };

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        lockKeyboard();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    const blockShortcuts = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' || 
        e.key === 'F11' || 
        e.key === 'F5' || 
        (e.ctrlKey && e.key === 'r') || 
        (e.ctrlKey && e.key === 'R') ||
        e.key === 'Tab'
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', blockShortcuts);

    const blockContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', blockContextMenu);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', blockShortcuts);
      document.removeEventListener('contextmenu', blockContextMenu);
      if (typeof window !== 'undefined' && 'keyboard' in navigator && (navigator.keyboard as any).unlock) {
        (navigator.keyboard as any).unlock();
      }
    };
  }, []);

  // WebSocket Integration
  const wsUrl = `ws://localhost:8080/ws?kd_poli=${kdPoli}`;
  useWebSocket({
    url: wsUrl,
    onMessage: (event) => {
      if (event.event === 'queue_updated') {
        fetchData(); // Refresh data antrian secara instan saat ada update dari petugas
      }
    },
    onConnect: () => setConnected(true),
    onDisconnect: () => setConnected(false),
  });

  if (!queueData) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0A0F1E]">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-t-transparent border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400 font-medium">Memuat Layar Antrian Poliklinik...</p>
        </div>
      </div>
    );
  }

  // Gandakan daftar antrian menunggu jika panjang agar dapat melingkar tanpa celah
  const showMarquee = queueData.waiting.length > 5;
  const waitingList = showMarquee
    ? [...queueData.waiting, ...queueData.waiting, ...queueData.waiting]
    : queueData.waiting;

  return (
    <div className="flex flex-col h-screen overflow-hidden p-6 gap-6 bg-[#0A0F1E] text-white">
      {/* Header */}
      <header className="flex justify-between items-center glass-card px-8 py-4 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
        <div className="flex items-center gap-4">
          <img src="/logo_rsudds.png" alt="Logo RSUD Datu Sanggul" className="h-12 w-12 object-contain" />
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white font-heading">
              RSUD DATU SANGGUL
            </h1>
            <p className="text-sm text-gray-400 tracking-wider uppercase">
              {queueData.nm_poli}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-2xl font-bold font-mono tracking-wider text-blue-400">
            {currentTime}
          </p>
          <p className="text-sm text-gray-400 font-medium">
            {currentDate}
          </p>
        </div>
      </header>

      {/* Main Grid Area */}
      <main className="grid grid-cols-12 flex-1 gap-6 min-h-0">

        {/* Left Column: Calling & Examining */}
        <section className="col-span-6 flex flex-col gap-6">

          {/* Card: Sedang Dipanggil */}
          <div className="flex-1 glass-card rounded-2xl p-8 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex justify-between items-center">
              <span className="bg-blue-600/20 text-blue-400 text-4xl font-bold px-4 py-1.5 rounded-full border border-blue-500/20 uppercase tracking-widest">
                Nomor Sedang Dipanggil
              </span>
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                <span className="text-xs text-gray-400 font-medium">
                  {connected ? 'Real-time Link Connected' : 'Offline Mode'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-6 items-center justify-center flex-1 my-4">
              <div className="text-center">
                <div className="text-[13rem] font-black tracking-widest text-blue-500 glow-call font-heading leading-none">
                  {queueData.current_calling?.no_reg || '—'}
                </div>
                <p className="text-6xl text-gray-300 font-bold mt-2">
                  {queueData.current_calling?.nm_pasien || 'Tidak ada antrian aktif'}
                </p>
              </div>

              <div className="bg-blue-950/20 border border-blue-900/30 rounded-xl py-3 px-6 text-center w-full max-w-2xl">
                <p className="text-lg text-blue-300 font-medium animate-pulse">
                  {queueData.current_calling ? `📢 Silakan menuju ke ${queueData.nm_poli}` : 'Menunggu panggilan petugas'}
                </p>
              </div>
            </div>
          </div>

          {/* Card: Sedang Diperiksa */}
          <div className="h-64 glass-card rounded-2xl p-8 flex items-center justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
            <div>
              <span className="bg-emerald-600/20 text-emerald-400 text-lg font-bold px-4 py-1.5 rounded-full border border-emerald-500/20 uppercase tracking-wider">
                Sedang Diperiksa
              </span>
              <h3 className="text-5xl font-bold mt-5 text-white">
                {queueData.current_examining?.nm_pasien || 'Tidak ada pasien'}
              </h3>
              <p className="text-xl text-gray-400 mt-3">
                {queueData.current_examining ? 'Sedang berada di dalam ruangan dokter' : 'Menunggu giliran periksa'}
              </p>
            </div>
            <div className="text-[6rem] font-black text-emerald-400 glow-exam font-heading pr-4">
              {queueData.current_examining?.no_reg || '—'}
            </div>
          </div>

        </section>

        {/* Right Column: Waiting List */}
        <section className="col-span-6 glass-card rounded-2xl p-6 flex flex-col min-h-0 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-amber-500"></div>
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-800">
            <h2 className="text-lg font-bold uppercase tracking-wider text-amber-500">
              Antrian Menunggu
            </h2>
            <span className="bg-gray-800 text-gray-300 text-xs font-bold px-2.5 py-1 rounded-md">
              {queueData.summary.total_menunggu} Total
            </span>
          </div>

          {/* Scroller Area */}
          <div className="flex-1 overflow-hidden relative rounded-xl bg-gray-950/40 border border-gray-900/50">
            {queueData.waiting.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 font-medium">
                Antrian kosong
              </div>
            ) : (
              <div className="h-full overflow-hidden relative">
                {/* Fade overlays */}
                <div className="absolute top-0 left-0 w-full h-12 bg-gradient-to-b from-[#0e1424] to-transparent z-10 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-[#0e1424] to-transparent z-10 pointer-events-none"></div>

                {/* Animated Marquee Container */}
                <div className={`flex flex-col gap-3 py-4 ${showMarquee ? 'animate-marquee-vertical' : ''}`}>
                  {waitingList.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-6 bg-gray-900/60 border border-gray-800/80 rounded-2xl mx-4 transition-all hover:bg-gray-800/80"
                    >
                      <div className="flex items-center gap-6">
                        <span className="text-5xl font-black text-amber-500 font-heading bg-amber-500/10 px-5 py-2.5 rounded-xl border border-amber-500/20">
                          {item.no_reg}
                        </span>
                        <div>
                          <p className="text-4xl font-bold text-white leading-tight">
                            {item.nm_pasien}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="glass-card px-8 py-3 rounded-2xl flex justify-between items-center text-sm text-gray-400 font-medium relative">
        <p>Mohon perhatikan layar ini. Pastikan nomor antrian Anda tersedia.</p>
        <p className="text-xs text-gray-500">Sistem Informasi Antrian v1.0.0 — RSUD Datu Sanggul</p>
      </footer>
    </div>
  );
}

export default function PasienDisplayPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#0A0F1E]">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-t-transparent border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400 font-medium">Memuat...</p>
        </div>
      </div>
    }>
      <PasienDisplayContent />
    </Suspense>
  );
}
