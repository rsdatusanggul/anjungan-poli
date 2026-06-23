'use client';

import { useEffect, useRef, useCallback } from 'react';
import { WebSocketEvent } from '@/lib/types';

interface UseWebSocketOptions {
  url: string;
  onMessage: (event: WebSocketEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket({ url, onMessage, onConnect, onDisconnect }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelay = useRef(1000); // Mulai dari 1 detik

  // Simpan callback ke dalam ref agar perubahan fungsinya tidak memicu pembuatan ulang connect
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);

  // Selalu perbarui ref ke nilai callback terbaru
  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
  });

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WebSocket] Connected');
      reconnectDelay.current = 1000; // Reset delay saat berhasil
      onConnectRef.current?.();
    };

    ws.onmessage = (event) => {
      try {
        const data: WebSocketEvent = JSON.parse(event.data);
        onMessageRef.current(data);
      } catch (err) {
        console.error('[WebSocket] Parse error:', err);
      }
    };

    ws.onclose = () => {
      console.log('[WebSocket] Disconnected, retrying...');
      onDisconnectRef.current?.();
      // Exponential backoff reconnect
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
        connect();
      }, reconnectDelay.current);
    };

    ws.onerror = (event: Event) => {
      console.error('[WebSocket] Error:', event);
      ws.close();
    };
  }, [url]); // HANYA bergantung pada url

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        // Hapus callback listener agar tidak terpicu saat unmount/close
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { ws: wsRef.current };
}
