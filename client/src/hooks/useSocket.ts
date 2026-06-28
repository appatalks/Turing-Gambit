import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { MatchState, MatchConfig } from '../types';

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (window.location.protocol === 'file:' ? 'http://localhost:3001' : window.location.origin);

export interface BurstFrame {
  tick: number;
  boardState: string;
  actions: { w: string; b: string };
  events: string[];
}

export interface StrategyBurst {
  frames: BurstFrame[];
  finalState: string;
  gameOver: boolean;
  iteration: number;
}

export interface StrategyCountdown {
  side: 'w' | 'b';
  durationMs: number;
  iteration: number;
}

export interface ArcadeRunEvent {
  game: string;
  iteration: number;
  whiteCode: string;
  blackCode: string;
  humanSide?: 'w' | 'b' | null;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thinkingText, setThinkingText] = useState<{ w: string; b: string }>({ w: '', b: '' });
  const [burst, setBurst] = useState<StrategyBurst | null>(null);
  const [countdown, setCountdown] = useState<StrategyCountdown | null>(null);
  const [executing, setExecuting] = useState(false);
  const [arcadeRun, setArcadeRun] = useState<ArcadeRunEvent | null>(null);

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

    socket.on('strategy-burst', (data: StrategyBurst) => {
      setBurst(data);
      setExecuting(false);
    });

    socket.on('strategy-countdown', (data: StrategyCountdown) => {
      setCountdown(data);
    });

    socket.on('strategy-executing', () => {
      setExecuting(true);
      setCountdown(null);
    });

    socket.on('arcade-run', (data: ArcadeRunEvent) => {
      setArcadeRun(data);
      setExecuting(false);
    });

    socket.on('match-reset', () => {
      setMatchState(null);
      setThinkingText({ w: '', b: '' });
      setBurst(null);
      setCountdown(null);
      setExecuting(false);
      setArcadeRun(null);
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

  const submitStrategy = useCallback((side: 'w' | 'b', code: string) => {
    socketRef.current?.emit('submit-strategy', { side, code });
    setCountdown(null);
  }, []);

  const clearBurst = useCallback(() => {
    setBurst(null);
  }, []);

  const reportArcadeResult = useCallback((result: { winner: string; reason: string; ticks: number; feedback?: string }) => {
    socketRef.current?.emit('arcade-result', result);
    setArcadeRun(null);
  }, []);

  return {
    connected,
    matchState,
    thinkingText,
    error,
    burst,
    countdown,
    executing,
    arcadeRun,
    startMatch,
    setKeys,
    pauseMatch,
    resumeMatch,
    stepMatch,
    submitHumanMove,
    submitStrategy,
    clearBurst,
    reportArcadeResult,
    resetMatch,
    exportMatch,
  };
}
