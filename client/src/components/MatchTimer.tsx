import { useState, useEffect, useRef } from 'react';
import type { MatchState } from '../types';
import { playerLabel } from '../lib/games';

interface Props {
  state: MatchState;
}

export function MatchTimer({ state }: Props) {
  const [now, setNow] = useState(Date.now());
  const thinkingStartRef = useRef<number | null>(null);
  const matchStartRef = useRef<number>(Date.now());

  // Tick every second while match is running
  useEffect(() => {
    if (state.status === 'active' || state.status === 'paused') {
      const id = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(id);
    }
  }, [state.status]);

  // Track when thinking starts/stops
  useEffect(() => {
    if (state.thinking) {
      if (!thinkingStartRef.current) thinkingStartRef.current = Date.now();
    } else {
      thinkingStartRef.current = null;
    }
  }, [state.thinking, state.thinkingPlayer]);

  const moves = state.moveHistory;
  const whiteMoves = moves.filter((m) => m.color === 'w');
  const blackMoves = moves.filter((m) => m.color === 'b');

  // Cumulative from completed moves
  const whiteRecorded = whiteMoves.reduce((s, m) => s + m.latencyMs, 0);
  const blackRecorded = blackMoves.reduce((s, m) => s + m.latencyMs, 0);

  // Live thinking time for the current thinker
  const liveMs = thinkingStartRef.current ? now - thinkingStartRef.current : 0;

  const whiteTotal = whiteRecorded + (state.thinkingPlayer === 'w' ? liveMs : 0);
  const blackTotal = blackRecorded + (state.thinkingPlayer === 'b' ? liveMs : 0);
  const matchTotal = whiteTotal + blackTotal;

  return (
    <div className="match-timer">
      <TimerCell label="Match" ms={matchTotal} />
      <TimerCell label={playerLabel(state.game, 'w')} ms={whiteTotal} active={state.thinking && state.thinkingPlayer === 'w'} />
      <TimerCell label={playerLabel(state.game, 'b')} ms={blackTotal} active={state.thinking && state.thinkingPlayer === 'b'} />
    </div>
  );
}

function TimerCell({ label, ms, active }: { label: string; ms: number; active?: boolean }) {
  return (
    <div className={`timer-cell ${active ? 'timer-active' : ''}`}>
      <span className="timer-label">{label}</span>
      <span className="timer-value mono">{formatTime(ms)}</span>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}
