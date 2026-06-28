import { useState, useEffect, useRef, useCallback } from 'react';

interface Props {
  boardState: string;
  interactive?: boolean;
  onHumanMove?: (notation: string) => void;
  legalMoves?: string[];
}

// Targets are real-ish installations positioned on the world map.
// Side A = Western bloc (Americas + allies), Side B = Eastern bloc (Eurasia).
const SIDE_A = [
  { name: 'CHEYENNE MTN', x: 175, y: 150, coord: '38.7°N 104.8°W' },
  { name: 'VANDENBERG', x: 120, y: 165, coord: '34.7°N 120.5°W' },
  { name: 'MINOT AFB', x: 200, y: 120, coord: '48.4°N 101.3°W' },
  { name: 'OFFUTT AFB', x: 215, y: 155, coord: '41.1°N 95.9°W' },
  { name: 'KINGS BAY', x: 245, y: 180, coord: '30.8°N 81.5°W' },
  { name: 'BANGOR WA', x: 130, y: 130, coord: '47.7°N 122.7°W' },
  { name: 'BRASILIA', x: 270, y: 270, coord: '15.8°S 47.9°W' },
  { name: 'THULE AB', x: 320, y: 60, coord: '76.5°N 68.7°W' },
];
const SIDE_B = [
  { name: 'PLESETSK', x: 510, y: 95, coord: '62.9°N 40.6°E' },
  { name: 'SEVERODVINSK', x: 540, y: 80, coord: '64.6°N 39.8°E' },
  { name: 'DOMBAROVSKY', x: 580, y: 135, coord: '51.0°N 59.9°E' },
  { name: 'YASNY', x: 615, y: 150, coord: '51.1°N 59.8°E' },
  { name: 'JIUQUAN', x: 650, y: 175, coord: '40.9°N 100.3°E' },
  { name: 'WUZHAI', x: 685, y: 165, coord: '38.9°N 111.6°E' },
  { name: 'PYONGYANG', x: 715, y: 180, coord: '39.0°N 125.8°E' },
  { name: 'TEHRAN', x: 545, y: 195, coord: '35.7°N 51.4°E' },
];

const SUB_A = { x: 90, y: 280, name: 'SSBN OHIO' };
const SUB_B = { x: 480, y: 290, name: 'SSBN BOREI' };
const AIR_A = { x: 230, y: 90, name: 'B-2 SPIRIT' };
const AIR_B = { x: 620, y: 70, name: 'TU-160' };

function parseState(s: string) {
  const parts = s.split(' ');
  return {
    a: (parts[0] || 'iiiiiiii').split(''),
    b: (parts[1] || 'iiiiiiii').split(''),
    defcon: parseInt(parts[2] || '5'),
    round: parseInt(parts[3] || '1'),
    turn: parts[4] || 'w',
  };
}

interface Trajectory {
  id: number;
  type: 'icbm' | 'slbm' | 'bomber' | 'mirv';
  from: { x: number; y: number };
  to: { x: number; y: number };
  startTime: number;
  duration: number;
  targetKey: string;
}

const TRAJ_DURATION: Record<string, number> = { icbm: 2000, slbm: 1800, bomber: 2400, mirv: 2200 };
const TRAJ_COLORS: Record<string, string> = { icbm: '#ff4422', slbm: '#22ccff', bomber: '#ffbb33', mirv: '#ff44dd' };

export function WarGamesBoardView({ boardState, interactive = false, onHumanMove, legalMoves = [] }: Props) {
  const { a, b, defcon, round, turn } = parseState(boardState);
  const [trajectories, setTrajectories] = useState<Trajectory[]>([]);
  const [now, setNow] = useState(Date.now());
  const [displayDestroyed, setDisplayDestroyed] = useState<Set<string>>(new Set());
  const [eventLog, setEventLog] = useState<{ id: number; text: string; color: string }[]>([]);
  const trajIdRef = useRef(0);
  const eventIdRef = useRef(0);
  const prevBoardRef = useRef<string | null>(null);

  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const dragRef = useRef<{ startX: number; startY: number; vx: number; vy: number } | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 33);
    return () => clearInterval(id);
  }, []);

  function logEvent(text: string, color: string) {
    const id = ++eventIdRef.current;
    setEventLog((prev) => [{ id, text, color }, ...prev].slice(0, 6));
  }

  // Detect changes, spawn trajectories, delay destruction visual
  useEffect(() => {
    if (prevBoardRef.current === null) {
      const initial = new Set<string>();
      a.forEach((s, i) => { if (s === 'd') initial.add(`a-${i}`); });
      b.forEach((s, i) => { if (s === 'd') initial.add(`b-${i}`); });
      setDisplayDestroyed(initial);
      prevBoardRef.current = boardState;
      return;
    }

    const prev = parseState(prevBoardRef.current);
    const allIntact = a.every((s) => s === 'i') && b.every((s) => s === 'i');
    if (round === 1 && allIntact && (prev.round > 1 || prev.a.some((s) => s === 'd') || prev.b.some((s) => s === 'd'))) {
      setDisplayDestroyed(new Set());
      setTrajectories([]);
      setEventLog([]);
      prevBoardRef.current = boardState;
      return;
    }
    prevBoardRef.current = boardState;

    for (let i = 0; i < 8; i++) {
      if (prev.b[i] !== 'd' && b[i] === 'd') spawnTrajectory('w', SIDE_B[i], `b-${i}`, SIDE_B[i].name);
      if (prev.a[i] !== 'd' && a[i] === 'd') spawnTrajectory('b', SIDE_A[i], `a-${i}`, SIDE_A[i].name);
    }
  }, [boardState]);

  function spawnTrajectory(fromSide: string, target: { x: number; y: number }, targetKey: string, targetName: string) {
    const types: Array<'icbm' | 'slbm' | 'bomber' | 'mirv'> = ['icbm', 'slbm', 'bomber', 'mirv'];
    const type = types[trajIdRef.current % 4];
    const srcArr = fromSide === 'w' ? SIDE_A : SIDE_B;
    const from = type === 'slbm' ? (fromSide === 'w' ? SUB_A : SUB_B)
      : type === 'bomber' ? (fromSide === 'w' ? AIR_A : AIR_B)
      : srcArr[Math.floor(Math.random() * 8)];

    const id = ++trajIdRef.current;
    const duration = TRAJ_DURATION[type];
    setTrajectories((prev) => [...prev, { id, type, from, to: target, startTime: Date.now(), duration, targetKey }]);
    logEvent(`${type.toUpperCase()} LAUNCH → ${targetName}`, TRAJ_COLORS[type]);

    setTimeout(() => {
      setDisplayDestroyed((prev) => new Set(prev).add(targetKey));
      logEvent(`IMPACT CONFIRMED: ${targetName}`, '#ff2222');
    }, duration);
    setTimeout(() => setTrajectories((prev) => prev.filter((t) => t.id !== id)), duration + 1500);
  }

  // ── Pan/Zoom ───────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    setView((v) => ({ ...v, zoom: Math.min(Math.max(v.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 1), 5) }));
  }, []);
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (view.zoom <= 1) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, vx: view.x, vy: view.y };
  }, [view]);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = (e.clientX - dragRef.current.startX) / view.zoom;
    const dy = (e.clientY - dragRef.current.startY) / view.zoom;
    setView((v) => ({ ...v, x: dragRef.current!.vx - dx, y: dragRef.current!.vy - dy }));
  }, [view.zoom]);
  const onMouseUp = useCallback(() => { dragRef.current = null; }, []);

  const vbW = 800 / view.zoom;
  const vbH = 380 / view.zoom;
  const vbX = Math.max(0, Math.min(800 - vbW, view.x + (800 - vbW) / 2));
  const vbY = Math.max(0, Math.min(380 - vbH, view.y + (380 - vbH) / 2));

  const isPlayerA = turn === 'w';
  const strikeTypes = ['ICBM', 'SLBM', 'BOMBER', 'MIRV'];
  const strikeMoves = new Map<string, number[]>();
  strikeTypes.forEach((t) => {
    strikeMoves.set(t, legalMoves.filter((m) => m.startsWith(t + ' ')).map((m) => parseInt(m.split(' ')[1]) - 1));
  });
  const defendTargets = legalMoves.filter((m) => m.startsWith('DEFEND')).map((m) => parseInt(m.split(' ')[1]) - 1);
  const canNegotiate = legalMoves.includes('NEGOTIATE');

  function isTargeted(pos: { x: number; y: number }) {
    return trajectories.some((t) => now - t.startTime < t.duration && t.to.x === pos.x && t.to.y === pos.y);
  }

  function renderInstallation(status: string, idx: number, inst: typeof SIDE_A[0], side: 'a' | 'b') {
    const key = `${side}-${idx}`;
    const destroyed = displayDestroyed.has(key);
    const defended = status === 'f' && !destroyed;
    const targeted = isTargeted(inst) && !destroyed;
    const isEnemy = (isPlayerA && side === 'b') || (!isPlayerA && side === 'a');
    const canDefendHere = interactive && !isEnemy && defendTargets.includes(idx);
    const color = destroyed ? '#ff3333' : targeted ? '#ff7700' : defended ? '#33aaff' : (side === 'a' ? '#33ddff' : '#ff6644');

    return (
      <g key={key} style={{ cursor: canDefendHere ? 'pointer' : 'default' }}
        onClick={canDefendHere ? () => onHumanMove?.(`DEFEND ${idx + 1}`) : undefined}>
        {/* Tracking reticle when targeted */}
        {targeted && (
          <g stroke="#ff5500" strokeWidth={1} fill="none" opacity={0.8}>
            <rect x={inst.x - 12} y={inst.y - 12} width={24} height={24}>
              <animate attributeName="opacity" values="1;0.3;1" dur="0.6s" repeatCount="indefinite" />
            </rect>
            <line x1={inst.x - 16} y1={inst.y} x2={inst.x - 12} y2={inst.y} />
            <line x1={inst.x + 12} y1={inst.y} x2={inst.x + 16} y2={inst.y} />
            <line x1={inst.x} y1={inst.y - 16} x2={inst.x} y2={inst.y - 12} />
            <line x1={inst.x} y1={inst.y + 12} x2={inst.x} y2={inst.y + 16} />
            <text x={inst.x} y={inst.y - 18} textAnchor="middle" fontSize={5} fill="#ff5500">⚠ TRACKING</text>
          </g>
        )}
        {/* Defense dome */}
        {defended && (
          <path d={`M${inst.x - 12},${inst.y + 2} A12,12 0 0,1 ${inst.x + 12},${inst.y + 2}`}
            fill="rgba(51,170,255,0.08)" stroke="#33aaff" strokeWidth={1} strokeDasharray="3,2" opacity={0.7} />
        )}
        {/* Installation marker (NATO-style) */}
        {destroyed ? (
          <g opacity={0.5}>
            <circle cx={inst.x} cy={inst.y} r={5} fill="rgba(255,51,51,0.2)" stroke="#ff3333" strokeWidth={1} />
            <line x1={inst.x - 4} y1={inst.y - 4} x2={inst.x + 4} y2={inst.y + 4} stroke="#ff3333" strokeWidth={1.2} />
            <line x1={inst.x + 4} y1={inst.y - 4} x2={inst.x - 4} y2={inst.y + 4} stroke="#ff3333" strokeWidth={1.2} />
          </g>
        ) : (
          <g style={{ filter: `drop-shadow(0 0 3px ${color})` }}>
            <rect x={inst.x - 4} y={inst.y - 4} width={8} height={8} fill="none" stroke={color} strokeWidth={1.2} />
            <circle cx={inst.x} cy={inst.y} r={1.5} fill={color} />
          </g>
        )}
        {/* Label + coordinates */}
        <text x={inst.x} y={inst.y + 14} textAnchor="middle" fontSize={5.5}
          fill={color} opacity={destroyed ? 0.3 : 0.85} fontFamily="var(--font-mono)">
          {idx + 1}·{inst.name}
        </text>
        {!destroyed && (
          <text x={inst.x} y={inst.y + 21} textAnchor="middle" fontSize={4}
            fill={color} opacity={0.4} fontFamily="var(--font-mono)">{inst.coord}</text>
        )}
        {canDefendHere && <text x={inst.x} y={inst.y - 8} textAnchor="middle" fontSize={6} fill="#33aaff">🛡</text>}
      </g>
    );
  }

  function renderStrikeOptions(inst: typeof SIDE_A[0], idx: number) {
    if (!interactive) return null;
    const available = strikeTypes.filter((t) => strikeMoves.get(t)?.includes(idx));
    if (available.length === 0) return null;
    const icons: Record<string, string> = { ICBM: '🚀', SLBM: '🌊', BOMBER: '✈', MIRV: '☢' };
    const colors: Record<string, string> = { ICBM: '#ff4422', SLBM: '#22ccff', BOMBER: '#ffbb33', MIRV: '#ff44dd' };
    return (
      <g>
        {available.map((type, ti) => {
          const bx = inst.x - 24 + ti * 16;
          const by = inst.y + 28;
          return (
            <g key={type} style={{ cursor: 'pointer' }} onClick={() => onHumanMove?.(`${type} ${idx + 1}`)}>
              <rect x={bx - 7} y={by - 6} width={14} height={12} rx={2} fill="rgba(0,10,20,0.85)" stroke={colors[type]} strokeWidth={0.8} />
              <text x={bx} y={by + 3} textAnchor="middle" fontSize={6} fill={colors[type]}>{icons[type]}</text>
            </g>
          );
        })}
      </g>
    );
  }

  return (
    <div className="wargames-board">
      <div className={`wg-defcon wg-defcon-${defcon}`}>
        <span className="wg-defcon-label">DEFCON</span>
        <span className="wg-defcon-level">{defcon}</span>
        <span className="wg-sim-counter">NORAD COMMAND · GLOBAL THREAT BOARD</span>
        <span className="wg-round">CYCLE {round}/16</span>
      </div>

      <div className="wg-status-bar">
        <div className="wg-status-item">
          <span className="wg-status-label">WEST BLOC</span>
          <span className="wg-status-val">{a.filter((s) => s !== 'd').length}/8 ONLINE</span>
        </div>
        <div className="wg-status-item">
          <span className="wg-status-label">TRACKS</span>
          <span className="wg-status-val wg-status-alert">{trajectories.length} INBOUND</span>
        </div>
        <div className="wg-status-item">
          <span className="wg-status-label">LOSSES</span>
          <span className="wg-status-val">{displayDestroyed.size}</span>
        </div>
        <div className="wg-status-item">
          <span className="wg-status-label">EAST BLOC</span>
          <span className="wg-status-val">{b.filter((s) => s !== 'd').length}/8 ONLINE</span>
        </div>
      </div>

      <div className="wg-map-container">
        <svg viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} className="wg-map wg-map-modern"
          onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove}
          onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          style={{ cursor: view.zoom > 1 ? (dragRef.current ? 'grabbing' : 'grab') : 'default' }}>
          <defs>
            <linearGradient id="ocean" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#04141f" />
              <stop offset="100%" stopColor="#020a14" />
            </linearGradient>
            <radialGradient id="sweep2" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#3399cc" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#3399cc" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Ocean */}
          <rect x={0} y={0} width={800} height={380} fill="url(#ocean)" />

          {/* Lat/long graticule */}
          {[...Array(17)].map((_, i) => (
            <line key={`mer${i}`} x1={i * 50} y1={0} x2={i * 50} y2={380} stroke="#1a4a66" strokeWidth={0.3} opacity={0.3} />
          ))}
          {[...Array(8)].map((_, i) => (
            <line key={`par${i}`} x1={0} y1={i * 50} x2={800} y2={i * 50} stroke="#1a4a66" strokeWidth={0.3} opacity={0.3} />
          ))}

          {/* Continents — equirectangular world map */}
          <g fill="#0d2438" stroke="#2a6a8a" strokeWidth={0.7} opacity={0.85}>
            {/* North America */}
            <path d="M70,70 Q120,55 180,72 L230,68 Q255,85 250,115 L235,145 Q220,175 250,185 L255,165 Q280,170 290,150 L270,130 Q250,90 230,95 L200,110 Q150,100 120,120 L90,135 Q60,110 70,70 Z" />
            {/* Greenland */}
            <path d="M300,45 Q330,40 345,60 L340,90 Q320,100 305,85 L300,65 Z" />
            {/* South America */}
            <path d="M250,200 Q280,195 295,215 L300,255 Q288,295 265,305 L258,275 Q248,235 250,200 Z" />
            {/* Europe */}
            <path d="M450,70 Q490,62 520,75 L545,72 Q560,85 550,100 L520,110 Q485,115 460,105 L448,90 Q445,78 450,70 Z" />
            {/* Africa */}
            <path d="M460,120 Q500,115 525,140 L535,175 Q528,225 500,250 L478,230 Q460,180 460,120 Z" />
            {/* Russia / Asia */}
            <path d="M555,65 Q640,52 730,70 L760,78 Q775,100 745,120 L660,135 Q580,138 560,115 L548,90 Q545,72 555,65 Z" />
            {/* India/SE Asia */}
            <path d="M620,140 Q655,138 670,160 L668,185 Q650,200 630,190 L618,165 Q615,150 620,140 Z" />
            {/* China east */}
            <path d="M675,130 Q720,128 740,150 L735,175 Q710,185 690,175 L678,155 Z" />
            {/* Australia */}
            <path d="M690,255 Q735,250 765,270 L770,300 Q740,315 705,305 L692,282 Z" />
          </g>

          {/* Center radar sweep */}
          <g transform="translate(400, 190)">
            <circle r="200" fill="url(#sweep2)" />
            {[60, 120, 180].map((r) => (
              <circle key={r} r={r} fill="none" stroke="#2a6a8a" strokeWidth={0.4} opacity={0.2} />
            ))}
            <g style={{ transform: `rotate(${(now / 25) % 360}deg)`, transformOrigin: '0 0' }}>
              <line x1="0" y1="0" x2="200" y2="0" stroke="#44aacc" strokeWidth={0.8} opacity={0.3} />
            </g>
          </g>

          {/* Bloc boundary */}
          <line x1={400} y1={10} x2={400} y2={370} stroke="#44aacc" strokeWidth={0.5} opacity={0.2} strokeDasharray="10,6" />
          <text x={130} y={30} textAnchor="middle" fontSize={9} fill="#33ddff" opacity={0.45} fontFamily="var(--font-mono)">◤ WESTERN COMMAND</text>
          <text x={670} y={30} textAnchor="middle" fontSize={9} fill="#ff6644" opacity={0.45} fontFamily="var(--font-mono)">EASTERN COMMAND ◥</text>

          {/* Strategic assets */}
          {[SUB_A, SUB_B].map((s, i) => (
            <text key={`sub${i}`} x={s.x} y={s.y} textAnchor="middle" fontSize={6} fill="#22ccff" opacity={0.5} fontFamily="var(--font-mono)">🌊 {s.name}</text>
          ))}
          {[AIR_A, AIR_B].map((s, i) => (
            <text key={`air${i}`} x={s.x} y={s.y} textAnchor="middle" fontSize={6} fill="#ffbb33" opacity={0.5} fontFamily="var(--font-mono)">✈ {s.name}</text>
          ))}

          {/* Trajectories with telemetry */}
          {trajectories.map((t) => {
            const elapsed = now - t.startTime;
            const progress = Math.min(elapsed / t.duration, 1);
            const color = TRAJ_COLORS[t.type];
            const arcH = t.type === 'bomber' ? 40 : 90;
            const cx = t.from.x + (t.to.x - t.from.x) * progress;
            const cy = t.from.y + (t.to.y - t.from.y) * progress - Math.sin(progress * Math.PI) * arcH;
            const midX = (t.from.x + t.to.x) / 2;
            const midY = Math.min(t.from.y, t.to.y) - arcH;
            const dash = t.type === 'slbm' ? '6,4' : t.type === 'bomber' ? '2,4' : t.type === 'mirv' ? '3,2,1,2' : '5,3';
            const eta = Math.max(0, Math.ceil((t.duration - elapsed) / 1000 * 10));
            const alt = Math.round(Math.sin(progress * Math.PI) * 1200);
            return (
              <g key={t.id}>
                <path d={`M${t.from.x},${t.from.y} Q${midX},${midY} ${t.to.x},${t.to.y}`}
                  fill="none" stroke={color} strokeWidth={0.8} opacity={0.4} strokeDasharray={dash} />
                {progress < 1 && (
                  <>
                    {/* Trail */}
                    {[...Array(6)].map((_, i) => {
                      const tp = Math.max(0, progress - i * 0.05);
                      const tx = t.from.x + (t.to.x - t.from.x) * tp;
                      const ty = t.from.y + (t.to.y - t.from.y) * tp - Math.sin(tp * Math.PI) * arcH;
                      return <circle key={i} cx={tx} cy={ty} r={1.8 - i * 0.25} fill={color} opacity={0.5 - i * 0.07} />;
                    })}
                    {/* Warhead */}
                    <circle cx={cx} cy={cy} r={t.type === 'bomber' ? 3.5 : 2.5} fill={color}
                      style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
                    {/* Telemetry readout */}
                    {progress > 0.08 && progress < 0.92 && (
                      <g fontFamily="var(--font-mono)">
                        <rect x={cx + 6} y={cy - 12} width={56} height={20} rx={2}
                          fill="rgba(0,10,20,0.75)" stroke={color} strokeWidth={0.4} opacity={0.85} />
                        <text x={cx + 9} y={cy - 4} fontSize={4.5} fill={color}>{t.type.toUpperCase()} ETA {eta}s</text>
                        <text x={cx + 9} y={cy + 3} fontSize={4.5} fill={color} opacity={0.7}>ALT {alt}km · MACH {(15 + Math.random() * 5).toFixed(0)}</text>
                      </g>
                    )}
                  </>
                )}
                {/* Impact */}
                {progress >= 0.9 && (
                  <g>
                    <circle cx={t.to.x} cy={t.to.y} r={10 + (progress - 0.9) * 120} fill="none" stroke={color}
                      strokeWidth={2} opacity={Math.max(0, 1 - (progress - 0.9) * 10)} style={{ filter: `drop-shadow(0 0 16px ${color})` }} />
                    <circle cx={t.to.x} cy={t.to.y} r={4 + (progress - 0.9) * 30} fill="#ffaa44"
                      opacity={Math.max(0, 0.8 - (progress - 0.9) * 8)} />
                  </g>
                )}
              </g>
            );
          })}

          {/* Installations */}
          {a.map((s, i) => renderInstallation(s, i, SIDE_A[i], 'a'))}
          {b.map((s, i) => renderInstallation(s, i, SIDE_B[i], 'b'))}
          {interactive && isPlayerA && b.map((s, i) => s !== 'd' ? renderStrikeOptions(SIDE_B[i], i) : null)}
          {interactive && !isPlayerA && a.map((s, i) => s !== 'd' ? renderStrikeOptions(SIDE_A[i], i) : null)}
        </svg>

        {/* CRT overlay */}
        <div className="wg-scanlines" />

        {/* Event log ticker */}
        <div className="wg-event-log">
          {eventLog.map((e) => (
            <div key={e.id} className="wg-event" style={{ color: e.color }}>
              ▸ {e.text}
            </div>
          ))}
        </div>

        {/* Zoom controls */}
        <div className="wg-zoom-controls">
          <button onClick={() => setView((v) => ({ ...v, zoom: Math.min(v.zoom * 1.3, 5) }))} title="Zoom in">+</button>
          <button onClick={() => setView((v) => ({ ...v, zoom: Math.max(v.zoom / 1.3, 1) }))} title="Zoom out">−</button>
          <button onClick={() => setView({ x: 0, y: 0, zoom: 1 })} title="Reset view">⊡</button>
        </div>
        {view.zoom > 1 && <div className="wg-zoom-level">{view.zoom.toFixed(1)}×</div>}
      </div>

      {interactive && canNegotiate && (
        <button className="wg-negotiate" onClick={() => onHumanMove?.('NEGOTIATE')}>
          ☮ NEGOTIATE — PROPOSE CEASEFIRE
        </button>
      )}

      <div className="wg-footer">GREETINGS, PROFESSOR FALKEN. SHALL WE PLAY A GAME?</div>
    </div>
  );
}
