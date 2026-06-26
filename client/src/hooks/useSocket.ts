import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { MatchState, MatchConfig } from '../types';

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (window.location.protocol === 'file:' ? 'http://localhost:3001' : window.location.origin);

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thinkingText, setThinkingText] = useState<{ w: string; b: string }>({ w: '', b: '' });

  useEffect(() => {
    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('match-state', (state: MatchState) => {
      setMatchState(state);
      setError(null);
    });

    socket.on('thinking-chunk', ({ color, text }: { color: 'w' | 'b'; text: string }) => {
      setThinkingText((prev) => ({ ...prev, [color]: text }));
    });

    socket.on('match-reset', () => {
      setMatchState(null);
      setThinkingText({ w: '', b: '' });
    });

    socket.on('match-error', (msg: string) => {
      setError(msg);
    });

    socket.on('connect_error', () => {
      setError('Cannot connect to server');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const startMatch = useCallback((config: MatchConfig) => {
    setError(null);
    socketRef.current?.emit('start-match', config);
  }, []);

  const setKeys = useCallback((keys: Record<string, string>) => {
    socketRef.current?.emit('set-keys', keys);
  }, []);

  const pauseMatch = useCallback(() => {
    socketRef.current?.emit('pause-match');
  }, []);

  const resumeMatch = useCallback(() => {
    socketRef.current?.emit('resume-match');
  }, []);

  const stepMatch = useCallback(() => {
    socketRef.current?.emit('step-match');
  }, []);

  const submitHumanMove = useCallback((uci: string) => {
    socketRef.current?.emit('human-move', uci);
  }, []);

  const resetMatch = useCallback(() => {
    socketRef.current?.emit('reset-match');
    setMatchState(null);
  }, []);

  const exportMatch = useCallback(() => {
    socketRef.current?.emit('export-match');
  }, []);

  return {
    connected,
    matchState,
    thinkingText,
    error,
    startMatch,
    setKeys,
    pauseMatch,
    resumeMatch,
    stepMatch,
    submitHumanMove,
    resetMatch,
    exportMatch,
  };
}
