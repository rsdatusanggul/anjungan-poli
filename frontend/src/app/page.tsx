'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getPoliklinik } from '@/lib/api';
import { Poliklinik } from '@/lib/types';

export default function Home() {
  const [polikliniks, setPolikliniks] = useState<Poliklinik[]>([]);
  const [selectedPoli, setSelectedPoli] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPoliklinik() {
      try {
        const data = await getPoliklinik();
        setPolikliniks(data);
        if (data.length > 0) {
          // Default ke Klinik Umum (U001 / U0016 / item pertama)
          const defaultPoli = data.find(p => p.kd_poli.startsWith('U001') || p.kd_poli === 'ANA') || data[0];
          setSelectedPoli(defaultPoli?.kd_poli || '');
        }
      } catch (err) {
        console.error(err);
        setError('Gagal memuat daftar poliklinik dari server.');
      } finally {
        setLoading(false);
      }
    }
    loadPoliklinik();
  }, []);

  const selectedPoliName = polikliniks.find(p => p.kd_poli === selectedPoli)?.nm_poli || '';

  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen bg-[#0A0F1E] text-white p-6 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-xl w-full text-center z-10 flex flex-col items-center">
        <img src="/logo_rsudds.png" alt="Logo RSUD Datu Sanggul" className="h-24 w-24 object-contain mb-6" />
        <h1 className="text-4xl font-black tracking-tight font-heading mb-3">
          SISTEM ANJUNGAN ANTRIAN
        </h1>
        <p className="text-gray-400 font-medium tracking-wide uppercase text-sm mb-10">
          RSUD DATU SANGGUL
        </p>

        {loading ? (
          <div className="glass-card w-full p-8 rounded-2xl flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent border-blue-500 mr-3"></div>
            <span className="text-gray-400 font-medium">Memuat Daftar Poliklinik...</span>
          </div>
        ) : error ? (
          <div className="glass-card w-full p-8 rounded-2xl text-center">
            <p className="text-rose-500 font-bold mb-4">⚠️ Koneksi Server Bermasalah</p>
            <p className="text-sm text-gray-400 mb-6">{error}</p>
            <button 
              onClick={() => { setLoading(true); window.location.reload(); }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-xl transition-all"
            >
              Coba Lagi
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-6">
            {/* Poliklinik Selector */}
            <div className="glass-card p-6 rounded-2xl text-left flex flex-col gap-3">
              <label htmlFor="poli-select" className="text-xs font-bold uppercase tracking-wider text-blue-400">
                Pilih Layanan Poliklinik
              </label>
              <select
                id="poli-select"
                value={selectedPoli}
                onChange={(e) => setSelectedPoli(e.target.value)}
                className="w-full bg-gray-950/80 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-all font-semibold"
              >
                {polikliniks.map((poli) => (
                  <option key={poli.kd_poli} value={poli.kd_poli} className="bg-gray-950 text-white">
                    {poli.nm_poli} ({poli.kd_poli})
                  </option>
                ))}
              </select>
            </div>

            {/* Navigation Cards */}
            <div className="grid grid-cols-2 gap-6 w-full">
              <button 
                onClick={async () => {
                  const targetUrl = `/pasien?kd_poli=${selectedPoli}`;
                  
                  // Deteksi Window Management API
                  if ('getScreenDetails' in window) {
                    try {
                      const screenDetails = await (window as any).getScreenDetails();
                      // Cari monitor sekunder (TV antrian)
                      const secondaryScreen = screenDetails.screens.find((screen: any) => !screen.isPrimary);
                      
                      if (secondaryScreen) {
                        // Buka langsung di layar kedua dengan posisi koordinat monitor sekunder
                        window.open(
                          targetUrl,
                          `DisplayPasien_${selectedPoli}`,
                          `left=${secondaryScreen.availLeft},` +
                          `top=${secondaryScreen.availTop},` +
                          `width=${secondaryScreen.availWidth},` +
                          `height=${secondaryScreen.availHeight},` +
                          `menubar=no,toolbar=no,location=no,status=no`
                        );
                        return;
                      }
                    } catch (err) {
                      console.warn('[Window Management] Izin ditolak atau gagal mendeteksi monitor kedua:', err);
                    }
                  }
                  
                  // Fallback: Buka di tab baru biasa jika API tidak didukung/ditolak
                  window.open(targetUrl, '_blank');
                }}
                className="glass-card hover:border-blue-500/50 p-8 rounded-2xl flex flex-col items-center gap-4 transition-all group hover:scale-[1.02] text-center w-full"
              >
                <div className="text-4xl bg-blue-500/10 group-hover:bg-blue-500/20 text-blue-400 h-16 w-16 rounded-2xl flex items-center justify-center transition-all border border-blue-500/15">
                  📺
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Display Pasien</h3>
                  <p className="text-xs text-gray-400 mt-1">Auto-open di layar TV kedua untuk {selectedPoliName}</p>
                </div>
              </button>

              <Link 
                href={`/petugas?kd_poli=${selectedPoli}`} 
                target="_blank"
                className="glass-card hover:border-indigo-500/50 p-8 rounded-2xl flex flex-col items-center gap-4 transition-all group hover:scale-[1.02]"
              >
                <div className="text-4xl bg-indigo-500/10 group-hover:bg-indigo-500/20 text-indigo-400 h-16 w-16 rounded-2xl flex items-center justify-center transition-all border border-indigo-500/15">
                  ⚙️
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-lg text-white">Panel Petugas</h3>
                  <p className="text-xs text-gray-400 mt-1">Buka panel operator panggil antrian untuk {selectedPoliName}</p>
                </div>
              </Link>
            </div>

            {/* Backup Kiosk Launcher Generator */}
            <div className="glass-card p-6 rounded-2xl text-left flex flex-col gap-4 mt-2">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500">
                  📁 Launcher Cadangan (Kiosk Mode Fallback)
                </h4>
                <p className="text-xs text-gray-400 mt-1">
                  Gunakan ini jika browser Anda gagal membuka layar kedua otomatis.
                </p>
              </div>
              
              <div className="flex flex-col md:flex-row gap-3 items-end">
                <div className="flex-1 flex flex-col gap-1.5 w-full">
                  <label htmlFor="linux-user" className="text-[10px] uppercase font-bold text-gray-400">
                    Nama User Linux Mint
                  </label>
                  <input
                    id="linux-user-input"
                    type="text"
                    placeholder="Contoh: mint"
                    defaultValue="mint"
                    className="w-full bg-gray-950/80 border border-gray-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50 text-white font-mono"
                  />
                </div>
                
                <button
                  onClick={() => {
                    const inputEl = document.getElementById('linux-user-input') as HTMLInputElement;
                    const linuxUser = inputEl?.value || 'mint';
                    const host = window.location.host; // Mengambil IP & port saat ini
                    
                    // 1. Generate anjungan.sh
                    const shContent = `#!/bin/bash
/opt/google/chrome/google-chrome \\
  --profile-directory=Default \\
  --user-data-dir=/tmp/chrome-session-${selectedPoli} \\
  --kiosk \\
  --new-window \\
  --window-position=1920,0 \\
  --start-fullscreen \\
  --ignore-profile-directory-if-not-exists \\
  http://${host}/pasien?kd_poli=${selectedPoli}
`;
                    
                    // 2. Generate anjungan.desktop
                    const desktopContent = `[Desktop Entry]
Version=1.0
Name=Anjungan Poli ${selectedPoli}
Comment=Buka halaman anjungan di layar kedua
Exec=/home/${linuxUser}/Documents/Anjungan_${selectedPoli}.sh
Icon=google-chrome
Terminal=false
Type=Application
Categories=Network;
`;

                    const downloadFile = (filename: string, text: string) => {
                      const element = document.createElement('a');
                      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
                      element.setAttribute('download', filename);
                      element.style.display = 'none';
                      document.body.appendChild(element);
                      element.click();
                      document.body.removeChild(element);
                    };

                    downloadFile(`Anjungan_${selectedPoli}.sh`, shContent);
                    downloadFile(`Anjungan_${selectedPoli}.desktop`, desktopContent);
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all whitespace-nowrap"
                >
                  📥 Unduh Script Cadangan
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500 mt-12 font-medium">
          Dikembangkan untuk RSUD Datu Sanggul © 2026
        </p>
      </div>
    </div>
  );
}
