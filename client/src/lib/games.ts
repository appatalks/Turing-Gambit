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
  { id: 'poker', icon: '🃏', name: 'Poker', category: 'strategy', description: 'Texas Hold\'em — bluff, bet, and read your opponent.' },
  { id: 'mysticquest', icon: '🧙', name: 'Mystic Quest', category: 'strategy', description: 'Explore, fight monsters, and duel the rival hero.' },
  // ── Social ──
  { id: 'prisonersdilemma', icon: '🤝', name: "Prisoner's Dilemma", category: 'social', description: 'Cooperate or defect for points.' },
  { id: 'debate', icon: '⚖️', name: 'Debate', category: 'social', description: 'Argue a resolution; an AI judges.' },
  { id: 'twentyquestions', icon: '❓', name: '20 Questions', category: 'social', description: 'Guess the secret word in 20 yes/no questions.' },
  { id: 'zork', icon: '🖥️', name: 'Zork I', category: 'strategy', description: 'Text adventure race — first to collect all treasures wins.' },
  { id: 'go', icon: '⚫', name: 'Go (9\u00d79)', category: 'board', description: 'The ancient strategy game. Surround territory and capture stones.' },
  { id: 'hitchhiker', icon: '🚀', name: "Hitchhiker's Guide", category: 'strategy', description: "Text adventure race through the galaxy. DON'T PANIC." },
  { id: 'maze', icon: '🏁', name: 'Maze Race', category: 'strategy', description: 'Navigate a procedural maze — first to the exit wins.' },
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

/** Game-specific player names instead of generic "White"/"Black". */
export function playerLabel(game: GameType | undefined, side: 'w' | 'b' | 'white' | 'black'): string {
  const isW = side === 'w' || side === 'white';
  switch (game) {
    case 'chess':             return isW ? 'White' : 'Black';
    case 'checkers':          return isW ? 'White' : 'Black';
    case 'tictactoe':         return isW ? 'X' : 'O';
    case 'connectfour':       return isW ? 'Red' : 'Yellow';
    case 'dotsandboxes':      return isW ? 'Player 1' : 'Player 2';
    case 'battleship':        return isW ? 'Fleet A' : 'Fleet B';
    case 'wargames':          return isW ? 'West' : 'East';
    case 'prisonersdilemma':  return isW ? 'Player A' : 'Player B';
    case 'debate':            return isW ? 'PRO' : 'CON';
    case 'risk':              return isW ? 'Blue' : 'Red';
    case 'poker':             return isW ? 'Player 1' : 'Player 2';
    case 'twentyquestions':   return isW ? 'Answerer' : 'Questioner';
    case 'mysticquest':       return isW ? 'Red Hero' : 'Blue Hero';
    case 'zork':              return isW ? 'Adventurer 1' : 'Adventurer 2';
    case 'go':                 return isW ? 'White' : 'Black';
    case 'hitchhiker':         return isW ? 'Player 1' : 'Player 2';
    case 'maze':               return isW ? 'Runner 1' : 'Runner 2';
    default:                  return isW ? 'White' : 'Black';
  }
}

/** Game-specific player icon. */
export function playerIcon(game: GameType | undefined, side: 'w' | 'b' | 'white' | 'black'): string {
  const isW = side === 'w' || side === 'white';
  switch (game) {
    case 'chess':             return isW ? '♔' : '♚';
    case 'checkers':          return isW ? '⬜' : '⬛';
    case 'tictactoe':         return isW ? '✕' : '○';
    case 'connectfour':       return isW ? '🔴' : '🟡';
    case 'dotsandboxes':      return isW ? '🔵' : '🟠';
    case 'battleship':        return isW ? '🚢' : '🚢';
    case 'wargames':          return isW ? '🟦' : '🟥';
    case 'prisonersdilemma':  return isW ? '🅰️' : '🅱️';
    case 'debate':            return isW ? '👍' : '👎';
    case 'risk':              return isW ? '🔵' : '🔴';
    case 'poker':             return isW ? '🃏' : '🃏';
    case 'twentyquestions':   return isW ? '🤫' : '🔍';
    case 'mysticquest':       return isW ? '🧙' : '🧝';
    case 'zork':              return isW ? '🧭' : '🗺️';
    case 'go':                 return isW ? '⚪' : '⚫';
    case 'hitchhiker':        return isW ? '🚀' : '🚀';
    case 'maze':              return isW ? '🟦' : '🟥';
    default:                  return isW ? '♔' : '♚';
  }
}
