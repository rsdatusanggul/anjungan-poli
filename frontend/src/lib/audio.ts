/**
 * Menghasilkan suara bel (chime) menggunakan Web Audio API
 */
export function playChime(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        resolve();
        return;
      }
      
      const ctx = new AudioContextClass();
      
      // Node synth sederhana
      const playTone = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.05);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      // Nada bel pintu (Ding-Dong)
      playTone(523.25, ctx.currentTime, 0.4);       // C5
      playTone(659.25, ctx.currentTime + 0.25, 0.6);  // E5
      
      setTimeout(() => {
        ctx.close();
        resolve();
      }, 900);
    } catch (e) {
      console.error('Failed to play chime', e);
      resolve();
    }
  });
}

/**
 * Memanggil nomor antrian menggunakan Web Speech API (Text-to-Speech)
 */
export function speakQueueNumber(noReg: string, nmPasien: string, nmPoli: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  // Hentikan suara yang sedang berjalan
  window.speechSynthesis.cancel();

  // Bersihkan format nomor antrian (contoh: "A007" menjadi "A nol nol tujuh")
  const chars = noReg.split('');
  const readFriendly = chars.map(char => {
    if (char === '0') return 'nol';
    return char;
  }).join(' ');

  const textToSpeak = `Nomor antrian, ${readFriendly}, atas nama ${nmPasien}, silakan menuju ${nmPoli}.`;
  const utterance = new SpeechSynthesisUtterance(textToSpeak);
  
  // Set bahasa ke Bahasa Indonesia jika tersedia
  utterance.lang = 'id-ID';
  
  // Temukan voice Bahasa Indonesia
  const voices = window.speechSynthesis.getVoices();
  const idVoice = voices.find(voice => voice.lang.includes('id') || voice.name.toLowerCase().includes('indonesian'));
  if (idVoice) {
    utterance.voice = idVoice;
  }
  
  utterance.rate = 0.9; // Sedikit lebih lambat agar jelas
  utterance.pitch = 1.0;

  window.speechSynthesis.speak(utterance);
}
