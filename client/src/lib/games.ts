import type { GameType } from '../types';

// ─── Game registry ──────────────────────────────────────
// Single source of truth for every playable mode. Add a new game here and it
// automatically appears (categorized) in the match-setup selector and the
// scoreboard filter. The server has a matching engine/prompt + match-manager
// wiring, and App.tsx renders the matching board component.

export type GameCategory = 'board' | 'strategy' | 'social' | 'arcade';

export interface GameInfo {
  id: GameType;
  icon: string;
  name: string;
  category: GameCategory;
  description: string;
}

export const GAME_CATEGORIES: { id: GameCategory; label: string; blurb: string }[] = [
  { id: 'board', label: 'Board', blurb: 'Classic turn-based board games' },
  { id: 'strategy', label: 'Strategy', blurb: 'Planning, deduction & conquest' },
  { id: 'social', label: 'Social', blurb: 'Negotiation, game theory & rhetoric' },
  { id: 'arcade', label: 'Arcade', blurb: 'Real-time reflex duels (tick-based)' },
];

export const GAMES: GameInfo[] = [
  // ── Board ──
  { id: 'chess', icon: '♟', name: 'Chess', category: 'board', description: 'The classic. Checkmate the king.' },
  { id: 'checkers', icon: '⬤', name: 'Checkers', category: 'board', description: 'Jump and capture to clear the board.' },
  { id: 'tictactoe', icon: '✕', name: 'Tic-Tac-Toe', category: 'board', description: 'Three in a row wins.' },
  { id: 'connectfour', icon: '🔴', name: 'Connect Four', category: 'board', description: 'Drop discs to line up four.' },
  { id: 'dotsandboxes', icon: '▦', name: 'Dots & Boxes', category: 'board', description: 'Close boxes to claim the most.' },
  // ── Strategy ──
  { id: 'wargames', icon: '☢', name: 'WarGames', category: 'strategy', description: 'Global thermonuclear strategy.' },
  { id: 'battleship', icon: '🚢', name: 'Battleship', category: 'strategy', description: 'Hunt and sink the hidden fleet.' },
  { id: 'risk', icon: '🌍', name: 'Risk', category: 'strategy', description: 'Conquer the world, territory by territory.' },
  // ── Social ──
  { id: 'prisonersdilemma', icon: '🤝', name: "Prisoner's Dilemma", category: 'social', description: 'Cooperate or defect for points.' },
  { id: 'debate', icon: '⚖️', name: 'Debate', category: 'social', description: 'Argue a resolution; an AI judges.' },
  // ── Arcade ──
  { id: 'mario', icon: '🍄', name: 'Platform Race', category: 'arcade', description: 'Side-scrolling sprint to the flag.' },
];

export const GAMES_BY_ID: Record<GameType, GameInfo> = Object.fromEntries(
  GAMES.map((g) => [g.id, g]),
) as Record<GameType, GameInfo>;

/** "♟ Chess" style label used by the selector and scoreboard. */
export function gameLabel(id: GameType): string {
  const g = GAMES_BY_ID[id];
  return g ? `${g.icon} ${g.name}` : id;
}

/** Games belonging to a category, in registry order. */
export function gamesInCategory(category: GameCategory): GameInfo[] {
  return GAMES.filter((g) => g.category === category);
}
