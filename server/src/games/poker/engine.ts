// ─── Texas Hold'em Poker Engine ──────────────────────────
// 2-player heads-up Texas Hold'em. Imperfect information:
// each player only sees their own hole cards + community cards.
// 20 hands max, 1000 starting chips. Standard betting rounds.

export type PokerColor = 'w' | 'b';
export type PokerStatus = 'active' | 'white_wins' | 'black_wins' | 'draw';

type Suit = 'h' | 'd' | 'c' | 's';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
interface Card { rank: Rank; suit: Suit; }

type BettingRound = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS: Suit[] = ['h', 'd', 'c', 's'];
const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

function cardStr(c: Card): string { return c.rank + c.suit; }

function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Hand evaluation — returns a comparable score (higher = better)
interface HandRank {
  category: number; // 0=high card, 1=pair, ..., 8=straight flush
  kickers: number[];
}

function evaluateHand(cards: Card[]): HandRank {
  // Generate all 5-card combos from 5-7 cards
  const combos = getCombinations(cards, 5);
  let best: HandRank = { category: -1, kickers: [] };
  for (const combo of combos) {
    const rank = rankFiveCards(combo);
    if (compareHands(rank, best) > 0) best = rank;
  }
  return best;
}

function getCombinations(arr: Card[], k: number): Card[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const result: Card[][] = [];
  const [first, ...rest] = arr;
  // Include first
  for (const combo of getCombinations(rest, k - 1)) {
    result.push([first, ...combo]);
  }
  // Exclude first
  for (const combo of getCombinations(rest, k)) {
    result.push(combo);
  }
  return result;
}

function rankFiveCards(cards: Card[]): HandRank {
  const values = cards.map((c) => RANK_VALUE[c.rank]).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);

  // Check straight
  let isStraight = false;
  const uniqueVals = [...new Set(values)].sort((a, b) => b - a);
  if (uniqueVals.length === 5) {
    if (uniqueVals[0] - uniqueVals[4] === 4) isStraight = true;
    // Ace-low straight (A-2-3-4-5)
    if (uniqueVals[0] === 14 && uniqueVals[1] === 5 && uniqueVals[4] === 2) isStraight = true;
  }

  // Count ranks
  const counts: Record<number, number> = {};
  for (const v of values) counts[v] = (counts[v] || 0) + 1;
  const groups = Object.entries(counts)
    .map(([v, c]) => ({ val: Number(v), count: c }))
    .sort((a, b) => b.count - a.count || b.val - a.val);

  if (isFlush && isStraight) {
    const high = uniqueVals[0] === 14 && uniqueVals[1] === 5 ? 5 : uniqueVals[0];
    return { category: 8, kickers: [high] };
  }
  if (groups[0].count === 4) return { category: 7, kickers: [groups[0].val, groups[1].val] };
  if (groups[0].count === 3 && groups[1].count === 2) return { category: 6, kickers: [groups[0].val, groups[1].val] };
  if (isFlush) return { category: 5, kickers: values };
  if (isStraight) {
    const high = uniqueVals[0] === 14 && uniqueVals[1] === 5 ? 5 : uniqueVals[0];
    return { category: 4, kickers: [high] };
  }
  if (groups[0].count === 3) return { category: 3, kickers: [groups[0].val, ...groups.slice(1).map((g) => g.val)] };
  if (groups[0].count === 2 && groups[1].count === 2) {
    const pairs = [groups[0].val, groups[1].val].sort((a, b) => b - a);
    return { category: 2, kickers: [...pairs, groups[2].val] };
  }
  if (groups[0].count === 2) return { category: 1, kickers: [groups[0].val, ...groups.slice(1).map((g) => g.val)] };
  return { category: 0, kickers: values };
}

function compareHands(a: HandRank, b: HandRank): number {
  if (a.category !== b.category) return a.category - b.category;
  for (let i = 0; i < Math.min(a.kickers.length, b.kickers.length); i++) {
    if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
  }
  return 0;
}

const HAND_NAMES = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'];

export class PokerEngine {
  private whiteChips = 1000;
  private blackChips = 1000;
  private pot = 0;
  private whiteHole: Card[] = [];
  private blackHole: Card[] = [];
  private community: Card[] = [];
  private deck: Card[] = [];
  private currentTurn: PokerColor = 'w';
  private bettingRound: BettingRound = 'preflop';
  private whiteBetThisRound = 0;
  private blackBetThisRound = 0;
  private handNumber = 0;
  private maxHands = 20;
  private moveCount = 0;
  private dealer: PokerColor = 'w'; // alternates each hand
  private lastAction = '';
  private handOver = false;
  private actionsThisRound = 0;
  private whiteActed = false;
  private blackActed = false;

  constructor() {
    this.startNewHand();
  }

  private startNewHand(): void {
    this.handNumber++;
    this.deck = makeDeck();
    this.whiteHole = [this.deck.pop()!, this.deck.pop()!];
    this.blackHole = [this.deck.pop()!, this.deck.pop()!];
    this.community = [];
    this.pot = 0;
    this.whiteBetThisRound = 0;
    this.blackBetThisRound = 0;
    this.bettingRound = 'preflop';
    this.handOver = false;
    this.actionsThisRound = 0;
    this.whiteActed = false;
    this.blackActed = false;

    // Blinds: dealer posts small blind (10), other posts big blind (20)
    const smallBlind = 10;
    const bigBlind = 20;
    if (this.dealer === 'w') {
      this.whiteChips -= smallBlind;
      this.blackChips -= bigBlind;
      this.whiteBetThisRound = smallBlind;
      this.blackBetThisRound = bigBlind;
      this.currentTurn = 'w'; // dealer acts first preflop in heads-up
    } else {
      this.blackChips -= smallBlind;
      this.whiteChips -= bigBlind;
      this.blackBetThisRound = smallBlind;
      this.whiteBetThisRound = bigBlind;
      this.currentTurn = 'b';
    }
    this.pot = smallBlind + bigBlind;
  }

  turn(): PokerColor {
    return this.currentTurn;
  }

  boardState(): string {
    // Format visible to spectators
    const wHole = this.handOver ? this.whiteHole.map(cardStr).join(',') : '??,??';
    const bHole = this.handOver ? this.blackHole.map(cardStr).join(',') : '??,??';
    const comm = this.community.map(cardStr).join(',') || '-';
    return `${wHole}|${bHole}|${comm}|${this.whiteChips}|${this.blackChips}|${this.pot}|${this.handNumber}|${this.currentTurn}|${this.bettingRound}`;
  }

  boardForPrompt(side: PokerColor): string {
    const lines: string[] = [];
    lines.push(`═══ TEXAS HOLD'EM — Hand ${this.handNumber}/${this.maxHands} ═══`);
    lines.push(`You are ${side === 'w' ? 'White' : 'Black'}`);
    lines.push('');

    // Only show YOUR hole cards
    const hole = side === 'w' ? this.whiteHole : this.blackHole;
    lines.push(`Your cards: ${hole.map(cardStr).join(' ')}`);
    lines.push(`Community: ${this.community.length > 0 ? this.community.map(cardStr).join(' ') : '(none yet)'}`);
    lines.push('');

    const myChips = side === 'w' ? this.whiteChips : this.blackChips;
    const oppChips = side === 'w' ? this.blackChips : this.whiteChips;
    lines.push(`Your chips: ${myChips} | Opponent chips: ${oppChips} | Pot: ${this.pot}`);

    const myBet = side === 'w' ? this.whiteBetThisRound : this.blackBetThisRound;
    const oppBet = side === 'w' ? this.blackBetThisRound : this.whiteBetThisRound;
    lines.push(`Your bet this round: ${myBet} | Opponent bet: ${oppBet}`);
    lines.push(`Round: ${this.bettingRound}`);

    return lines.join('\n');
  }

  legalMoves(): string[] {
    if (this.handOver) return [];

    const myBet = this.currentTurn === 'w' ? this.whiteBetThisRound : this.blackBetThisRound;
    const oppBet = this.currentTurn === 'w' ? this.blackBetThisRound : this.whiteBetThisRound;
    const myChips = this.currentTurn === 'w' ? this.whiteChips : this.blackChips;
    const moves: string[] = [];

    if (myBet < oppBet) {
      // Must call or fold
      moves.push('CALL');
      moves.push('FOLD');
      if (myChips > oppBet - myBet) moves.push('RAISE');
    } else {
      // Can check or bet
      moves.push('CHECK');
      if (myChips > 0) moves.push('BET');
      moves.push('FOLD');
    }

    return moves;
  }

  makeMove(notation: string): { san: string; captured?: string } | null {
    const move = notation.toUpperCase().trim();
    const side = this.currentTurn;
    const label = side === 'w' ? 'White' : 'Black';

    const myBet = side === 'w' ? this.whiteBetThisRound : this.blackBetThisRound;
    const oppBet = side === 'w' ? this.blackBetThisRound : this.whiteBetThisRound;

    let san = '';

    switch (move) {
      case 'FOLD': {
        san = `${label} folds`;
        // Opponent wins the pot
        if (side === 'w') this.blackChips += this.pot;
        else this.whiteChips += this.pot;
        this.pot = 0;
        this.finishHand();
        break;
      }
      case 'CALL': {
        const diff = oppBet - myBet;
        if (diff <= 0) return null;
        const actualCall = Math.min(diff, side === 'w' ? this.whiteChips : this.blackChips);
        if (side === 'w') { this.whiteChips -= actualCall; this.whiteBetThisRound += actualCall; }
        else { this.blackChips -= actualCall; this.blackBetThisRound += actualCall; }
        this.pot += actualCall;
        san = `${label} calls ${actualCall}`;

        if (side === 'w') this.whiteActed = true;
        else this.blackActed = true;
        this.actionsThisRound++;

        // After call, advance round
        this.advanceBettingRound();
        break;
      }
      case 'CHECK': {
        if (myBet < oppBet) return null; // can't check if facing a bet
        san = `${label} checks`;

        if (side === 'w') this.whiteActed = true;
        else this.blackActed = true;
        this.actionsThisRound++;

        // If both checked, advance
        if (this.whiteActed && this.blackActed) {
          this.advanceBettingRound();
        } else {
          this.currentTurn = side === 'w' ? 'b' : 'w';
        }
        break;
      }
      case 'BET':
      case 'RAISE': {
        const toCall = Math.max(0, oppBet - myBet);
        const raiseAmount = 20; // Fixed raise size for simplicity
        const totalNeeded = toCall + raiseAmount;
        const myChips = side === 'w' ? this.whiteChips : this.blackChips;
        const actual = Math.min(totalNeeded, myChips);

        if (side === 'w') { this.whiteChips -= actual; this.whiteBetThisRound += actual; }
        else { this.blackChips -= actual; this.blackBetThisRound += actual; }
        this.pot += actual;
        san = `${label} ${move === 'RAISE' ? 'raises' : 'bets'} ${actual}`;

        if (side === 'w') this.whiteActed = true;
        else this.blackActed = true;
        // Reset opponent's acted flag since they need to respond
        if (side === 'w') this.blackActed = false;
        else this.whiteActed = false;
        this.actionsThisRound++;

        this.currentTurn = side === 'w' ? 'b' : 'w';
        break;
      }
      default:
        return null;
    }

    this.moveCount++;
    this.lastAction = san;
    return { san };
  }

  private advanceBettingRound(): void {
    this.whiteBetThisRound = 0;
    this.blackBetThisRound = 0;
    this.whiteActed = false;
    this.blackActed = false;
    this.actionsThisRound = 0;

    switch (this.bettingRound) {
      case 'preflop':
        this.bettingRound = 'flop';
        this.community.push(this.deck.pop()!, this.deck.pop()!, this.deck.pop()!);
        break;
      case 'flop':
        this.bettingRound = 'turn';
        this.community.push(this.deck.pop()!);
        break;
      case 'turn':
        this.bettingRound = 'river';
        this.community.push(this.deck.pop()!);
        break;
      case 'river':
        this.bettingRound = 'showdown';
        this.resolveShowdown();
        return;
      default:
        return;
    }

    // Non-dealer acts first post-flop in heads-up
    this.currentTurn = this.dealer === 'w' ? 'b' : 'w';
  }

  private resolveShowdown(): void {
    const wCards = [...this.whiteHole, ...this.community];
    const bCards = [...this.blackHole, ...this.community];
    const wRank = evaluateHand(wCards);
    const bRank = evaluateHand(bCards);
    const cmp = compareHands(wRank, bRank);

    if (cmp > 0) {
      this.whiteChips += this.pot;
      this.lastAction = `Showdown: White wins with ${HAND_NAMES[wRank.category]}`;
    } else if (cmp < 0) {
      this.blackChips += this.pot;
      this.lastAction = `Showdown: Black wins with ${HAND_NAMES[bRank.category]}`;
    } else {
      // Split pot
      const half = Math.floor(this.pot / 2);
      this.whiteChips += half;
      this.blackChips += this.pot - half;
      this.lastAction = `Showdown: Split pot (both ${HAND_NAMES[wRank.category]})`;
    }
    this.pot = 0;
    this.finishHand();
  }

  private finishHand(): void {
    this.handOver = true;

    if (this.whiteChips <= 0 || this.blackChips <= 0 || this.handNumber >= this.maxHands) {
      return; // game over
    }

    // Start next hand after a brief state update
    this.dealer = this.dealer === 'w' ? 'b' : 'w';
    this.startNewHand();
  }

  isGameOver(): boolean {
    return this.gameStatus() !== 'active';
  }

  gameStatus(): PokerStatus {
    if (this.whiteChips <= 0) return 'black_wins';
    if (this.blackChips <= 0) return 'white_wins';
    if (this.handNumber > this.maxHands) {
      if (this.whiteChips > this.blackChips) return 'white_wins';
      if (this.blackChips > this.whiteChips) return 'black_wins';
      return 'draw';
    }
    return 'active';
  }

  getMoveCount(): number {
    return this.moveCount;
  }
}
