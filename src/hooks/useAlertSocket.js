import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_ALERTS_WS_URL || 'http://localhost:3001';

/**
 * Hook to connect to the Elora Alerts WebSocket server.
 * Returns live alerts received via socket and a connection status.
 */
export function useAlertSocket({ enabled = true, onAlert } = {}) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  const onAlertRef = useRef(onAlert);
  onAlertRef.current = onAlert;

  useEffect(() => {
    if (!enabled) return;

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[AlertSocket] Connected:', socket.id);
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[AlertSocket] Disconnected');
      setConnected(false);
    });

    socket.on('alert_created', (alert) => {
      if (onAlertRef.current) {
        onAlertRef.current(alert);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled]);

  const emit = useCallback((event, data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  return { connected, emit };
}
