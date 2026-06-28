import { useState } from 'react';

interface Props {
  boardState: string; // "phase turn pool | CODE:OWNER:ARMIES,..."
  interactive?: boolean;
  onHumanMove?: (notation: string) => void;
  legalMoves?: string[];
}

interface T { code: string; name: string; x: number; y: number; neighbors: string[]; }

// Positions + adjacency (mirrors server engine map)
const TERR: T[] = [
  { code: 'ALK', name: 'Alaska', x: 60, y: 95, neighbors: ['NWT', 'ALB', 'KAM'] },
  { code: 'NWT', name: 'NW Territory', x: 165, y: 90, neighbors: ['ALK', 'ALB', 'ONT', 'GRL'] },
  { code: 'GRL', name: 'Greenland', x: 320, y: 55, neighbors: ['NWT', 'ONT', 'QUE', 'ICE'] },
  { code: 'ALB', name: 'Alberta', x: 135, y: 165, neighbors: ['ALK', 'NWT', 'ONT', 'WUS'] },
  { code: 'ONT', name: 'Ontario', x: 220, y: 165, neighbors: ['NWT', 'ALB', 'GRL', 'QUE', 'WUS', 'EUS'] },
  { code: 'QUE', name: 'Quebec', x: 310, y: 165, neighbors: ['GRL', 'ONT', 'EUS'] },
  { code: 'WUS', name: 'Western US', x: 150, y: 245, neighbors: ['ALB', 'ONT', 'EUS', 'CAM'] },
  { code: 'EUS', name: 'Eastern US', x: 240, y: 255, neighbors: ['ONT', 'QUE', 'WUS', 'CAM'] },
  { code: 'CAM', name: 'C. America', x: 185, y: 330, neighbors: ['WUS', 'EUS', 'VEN'] },
  { code: 'VEN', name: 'Venezuela', x: 250, y: 380, neighbors: ['CAM', 'BRA', 'PER'] },
  { code: 'BRA', name: 'Brazil', x: 320, y: 430, neighbors: ['VEN', 'PER', 'ARG', 'NAF'] },
  { code: 'PER', name: 'Peru', x: 250, y: 460, neighbors: ['VEN', 'BRA', 'ARG'] },
  { code: 'ARG', name: 'Argentina', x: 270, y: 535, neighbors: ['PER', 'BRA'] },
  { code: 'ICE', name: 'Iceland', x: 430, y: 120, neighbors: ['GRL', 'GBR', 'SCA'] },
  { code: 'GBR', name: 'Great Britain', x: 440, y: 195, neighbors: ['ICE', 'SCA', 'NEU', 'WEU'] },
  { code: 'SCA', name: 'Scandinavia', x: 515, y: 110, neighbors: ['ICE', 'GBR', 'NEU', 'UKR'] },
  { code: 'NEU', name: 'N. Europe', x: 510, y: 200, neighbors: ['GBR', 'SCA', 'UKR', 'SEU', 'WEU'] },
  { code: 'WEU', name: 'W. Europe', x: 450, y: 270, neighbors: ['GBR', 'NEU', 'SEU', 'NAF'] },
  { code: 'SEU', name: 'S. Europe', x: 535, y: 265, neighbors: ['NEU', 'WEU', 'UKR', 'NAF', 'EGY', 'MEA'] },
  { code: 'UKR', name: 'Ukraine', x: 610, y: 165, neighbors: ['SCA', 'NEU', 'SEU', 'URA', 'AFG', 'MEA'] },
  { code: 'NAF', name: 'N. Africa', x: 480, y: 370, neighbors: ['BRA', 'WEU', 'SEU', 'EGY', 'EAF', 'CON'] },
  { code: 'EGY', name: 'Egypt', x: 550, y: 355, neighbors: ['SEU', 'NAF', 'EAF', 'MEA'] },
  { code: 'EAF', name: 'East Africa', x: 600, y: 425, neighbors: ['NAF', 'EGY', 'CON', 'SAF', 'MAD', 'MEA'] },
  { code: 'CON', name: 'Congo', x: 545, y: 465, neighbors: ['NAF', 'EAF', 'SAF'] },
  { code: 'SAF', name: 'S. Africa', x: 565, y: 535, neighbors: ['CON', 'EAF', 'MAD'] },
  { code: 'MAD', name: 'Madagascar', x: 640, y: 525, neighbors: ['EAF', 'SAF'] },
  { code: 'URA', name: 'Ural', x: 670, y: 145, neighbors: ['UKR', 'SIB', 'CHN', 'AFG'] },
  { code: 'SIB', name: 'Siberia', x: 725, y: 110, neighbors: ['URA', 'YAK', 'IRK', 'MON', 'CHN'] },
  { code: 'YAK', name: 'Yakutsk', x: 805, y: 85, neighbors: ['SIB', 'IRK', 'KAM'] },
  { code: 'KAM', name: 'Kamchatka', x: 890, y: 100, neighbors: ['YAK', 'IRK', 'MON', 'JPN', 'ALK'] },
  { code: 'IRK', name: 'Irkutsk', x: 765, y: 165, neighbors: ['SIB', 'YAK', 'KAM', 'MON'] },
  { code: 'MON', name: 'Mongolia', x: 795, y: 215, neighbors: ['SIB', 'KAM', 'IRK', 'JPN', 'CHN'] },
  { code: 'JPN', name: 'Japan', x: 905, y: 215, neighbors: ['KAM', 'MON'] },
  { code: 'AFG', name: 'Afghanistan', x: 665, y: 235, neighbors: ['UKR', 'URA', 'CHN', 'MEA', 'IND'] },
  { code: 'CHN', name: 'China', x: 765, y: 280, neighbors: ['URA', 'SIB', 'MON', 'AFG', 'IND', 'SIA'] },
  { code: 'MEA', name: 'Middle East', x: 625, y: 305, neighbors: ['UKR', 'SEU', 'EGY', 'EAF', 'AFG', 'IND'] },
  { code: 'IND', name: 'India', x: 715, y: 340, neighbors: ['AFG', 'CHN', 'MEA', 'SIA'] },
  { code: 'SIA', name: 'Siam', x: 795, y: 345, neighbors: ['CHN', 'IND', 'INO'] },
  { code: 'INO', name: 'Indonesia', x: 825, y: 425, neighbors: ['SIA', 'NGU', 'WAU'] },
  { code: 'NGU', name: 'New Guinea', x: 915, y: 430, neighbors: ['INO', 'WAU', 'EAU'] },
  { code: 'WAU', name: 'W. Australia', x: 845, y: 515, neighbors: ['INO', 'NGU', 'EAU'] },
  { code: 'EAU', name: 'E. Australia', x: 925, y: 525, neighbors: ['NGU', 'WAU'] },
];

const TMAP = new Map(TERR.map((t) => [t.code, t]));

// Build undirected adjacency edges once.
const EDGES: [T, T][] = [];
{
  const seen = new Set<string>();
  for (const t of TERR) {
    for (const n of t.neighbors) {
      const key = [t.code, n].sort().join('-');
      if (seen.has(key)) continue;
      seen.add(key);
      const o = TMAP.get(n);
      if (o) EDGES.push([t, o]);
    }
  }
}

interface Parsed { owner: 'W' | 'B'; armies: number; }

export function RiskBoard({ boardState, interactive = false, onHumanMove, legalMoves = [] }: Props) {
  const [sel, setSel] = useState<string | null>(null);

  const [head, body] = boardState.split('|');
  const headParts = (head || '').trim().split(/\s+/);
  const phase = headParts[0] || 'reinforce';
  const turn = headParts[1] || 'w';
  const pool = headParts[2] || '0';

  const cells = new Map<string, Parsed>();
  (body || '').trim().split(',').forEach((seg) => {
    const [code, owner, armies] = seg.split(':');
    if (code && owner) cells.set(code, { owner: owner as 'W' | 'B', armies: parseInt(armies) || 0 });
  });

  const myColor: 'W' | 'B' = turn === 'w' ? 'W' : 'B';

  function isLegal(notation: string) {
    return legalMoves.includes(notation);
  }

  function handleClick(code: string) {
    if (!interactive || !onHumanMove) return;
    const cell = cells.get(code);
    if (!cell) return;

    if (phase === 'reinforce') {
      if (cell.owner === myColor && isLegal(`REINFORCE ${code}`)) onHumanMove(`REINFORCE ${code}`);
      return;
    }
    if (phase === 'attack') {
      if (!sel) {
        if (cell.owner === myColor && cell.armies >= 2) setSel(code);
      } else if (sel === code) {
        setSel(null);
      } else {
        const mv = `ATTACK ${sel} ${code}`;
        if (isLegal(mv)) { onHumanMove(mv); setSel(null); }
        else if (cell.owner === myColor && cell.armies >= 2) setSel(code);
      }
      return;
    }
    if (phase === 'fortify') {
      if (!sel) {
        if (cell.owner === myColor && cell.armies >= 2) setSel(code);
      } else if (sel === code) {
        setSel(null);
      } else {
        const mv = `FORTIFY ${sel} ${code}`;
        if (isLegal(mv)) { onHumanMove(mv); setSel(null); }
        else if (cell.owner === myColor && cell.armies >= 2) setSel(code);
      }
    }
  }

  const turnLabel = turn === 'w' ? 'BLUE' : 'RED';

  return (
    <div className="risk-wrap">
      <div className="risk-status">
        <span className={`risk-turn risk-${turn}`}>{turnLabel}</span>
        <span className="risk-phase">{phase.toUpperCase()}</span>
        {phase === 'reinforce' && <span className="risk-pool">+{pool} armies</span>}
      </div>

      <svg className="risk-map" viewBox="0 0 985 575" preserveAspectRatio="xMidYMid meet">
        {EDGES.map(([a, b], i) => (
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="risk-edge" />
        ))}
        {TERR.map((t) => {
          const c = cells.get(t.code);
          const owner = c?.owner ?? 'W';
          const selectable = interactive && (
            (phase === 'reinforce' && owner === myColor && isLegal(`REINFORCE ${t.code}`)) ||
            (phase !== 'reinforce' && (
              (sel && (isLegal(`ATTACK ${sel} ${t.code}`) || isLegal(`FORTIFY ${sel} ${t.code}`))) ||
              (!sel && owner === myColor && (c?.armies ?? 0) >= 2)
            ))
          );
          return (
            <g
              key={t.code}
              className={`risk-node ${selectable ? 'risk-selectable' : ''} ${sel === t.code ? 'risk-selected' : ''}`}
              onClick={() => handleClick(t.code)}
            >
              <circle cx={t.x} cy={t.y} r={15} className={`risk-terr risk-own-${owner}`} />
              <text x={t.x} y={t.y + 4} className="risk-armies">{c?.armies ?? 0}</text>
              <text x={t.x} y={t.y - 19} className="risk-code">{t.code}</text>
            </g>
          );
        })}
      </svg>

      {interactive && (
        <div className="risk-actions">
          {phase === 'attack' && isLegal('END_ATTACK') && (
            <button className="risk-btn" onClick={() => { onHumanMove?.('END_ATTACK'); setSel(null); }}>End Attack</button>
          )}
          {phase === 'fortify' && isLegal('END_TURN') && (
            <button className="risk-btn" onClick={() => { onHumanMove?.('END_TURN'); setSel(null); }}>End Turn</button>
          )}
          {sel && <span className="risk-hint">Selected {sel} — pick a target</span>}
        </div>
      )}
    </div>
  );
}
