export type PokerColor = 'w' | 'b';
export type PokerSuit = 'h' | 'd' | 'c' | 's';
export type PokerStreet = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type PokerStatus = 'active' | 'white_wins' | 'black_wins' | 'draw';
export type PokerAction = 'FOLD' | 'CHECK' | 'CALL' | 'RAISE_SMALL' | 'RAISE_BIG' | 'ALL_IN';

export interface Card {
  rank: number;
  suit: PokerSuit;
}

interface PlayerState {
  chips: number;
  hole: Card[];
  streetBet: number;
  hasActed: boolean;
}

const STARTING_CHIPS = 1000;
const SMALL_BLIND = 10;
const BIG_BLIND = 20;
const MAX_HANDS = 20;
const ACTIONS: PokerAction[] = ['FOLD', 'CHECK', 'CALL', 'RAISE_SMALL', 'RAISE_BIG', 'ALL_IN'];
const SUITS: PokerSuit[] = ['h', 'd', 'c', 's'];
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatRank(rank: number): string {
  if (rank <= 10) return String(rank);
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return 'A';
}

function formatCard(card: Card): string {
  return `${formatRank(card.rank)}${card.suit}`;
}

function formatCards(cards: Card[]): string {
  return cards.length > 0 ? cards.map(formatCard).join(',') : '-';
}

function straightHigh(ranks: number[]): number | null {
  const unique = [...new Set(ranks)].sort((a, b) => b - a);
  if (unique.includes(14)) unique.push(1);

  let run = 1;
  for (let i = 0; i < unique.length - 1; i++) {
    if (unique[i] - 1 === unique[i + 1]) {
      run++;
      if (run >= 5) return unique[i - 3];
    } else {
      run = 1;
    }
  }
  return null;
}

function topRanksExcluding(
  counts: Map<number, number>,
  excluded: number[],
  amount: number,
): number[] {
  return [...counts.keys()]
    .filter((rank) => !excluded.includes(rank))
    .sort((a, b) => b - a)
    .slice(0, amount);
}

export function compareHandRanks(left: number[], right: number[]): number {
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const a = left[i] ?? 0;
    const b = right[i] ?? 0;
    if (a !== b) return a > b ? 1 : -1;
  }
  return 0;
}

export function evaluateHand(cards: Card[]): number[] {
  if (cards.length < 5) {
    throw new Error('At least five cards are required to evaluate a poker hand.');
  }

  const counts = new Map<number, number>();
  const suits = new Map<PokerSuit, Card[]>();

  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
    const suitedCards = suits.get(card.suit) ?? [];
    suitedCards.push(card);
    suits.set(card.suit, suitedCards);
  }

  const allRanksDesc = [...counts.keys()].sort((a, b) => b - a);

  for (const suitedCards of suits.values()) {
    if (suitedCards.length < 5) continue;
    const flushRanks = suitedCards.map((card) => card.rank);
    const straightFlush = straightHigh(flushRanks);
    if (straightFlush === 14) return [10];
    if (straightFlush !== null) return [9, straightFlush];
  }

  const grouped = [...counts.entries()].sort((a, b) => (
    b[1] !== a[1] ? b[1] - a[1] : b[0] - a[0]
  ));

  const four = grouped.find(([_, count]) => count === 4);
  if (four) {
    const kicker = topRanksExcluding(counts, [four[0]], 1)[0];
    return [8, four[0], kicker];
  }

  const trips = grouped.filter(([_, count]) => count >= 3).map(([rank]) => rank);
  const pairs = grouped.filter(([_, count]) => count >= 2).map(([rank]) => rank);
  if (trips.length > 0) {
    const tripRank = trips[0];
    const pairRank = pairs.find((rank) => rank !== tripRank) ?? trips[1];
    if (pairRank != null) return [7, tripRank, pairRank];
  }

  for (const suitedCards of suits.values()) {
    if (suitedCards.length < 5) continue;
    const topFlush = suitedCards
      .map((card) => card.rank)
      .sort((a, b) => b - a)
      .slice(0, 5);
    return [6, ...topFlush];
  }

  const straight = straightHigh(cards.map((card) => card.rank));
  if (straight !== null) return [5, straight];

  if (trips.length > 0) {
    const kickers = topRanksExcluding(counts, [trips[0]], 2);
    return [4, trips[0], ...kickers];
  }

  if (pairs.length >= 2) {
    const [highPair, lowPair] = pairs.sort((a, b) => b - a);
    const kicker = topRanksExcluding(counts, [highPair, lowPair], 1)[0];
    return [3, highPair, lowPair, kicker];
  }

  if (pairs.length === 1) {
    const pair = pairs[0];
    const kickers = topRanksExcluding(counts, [pair], 3);
    return [2, pair, ...kickers];
  }

  return [1, ...allRanksDesc.slice(0, 5)];
}

export class PokerEngine {
  private white: PlayerState = this.createPlayer(STARTING_CHIPS);
  private black: PlayerState = this.createPlayer(STARTING_CHIPS);
  private deck: Card[] = [];
  private community: Card[] = [];
  private currentTurn: PokerColor = 'w';
  private currentStreet: PokerStreet = 'preflop';
  private pot = 0;
  private handNumber = 1;
  private completedHands = 0;
  private smallBlindSide: PokerColor = 'w';
  private status: PokerStatus = 'active';
  private streetActions: string[] = [];

  constructor() {
    this.reset();
  }

  reset(): void {
    this.white = this.createPlayer(STARTING_CHIPS);
    this.black = this.createPlayer(STARTING_CHIPS);
    this.deck = [];
    this.community = [];
    this.currentTurn = 'w';
    this.currentStreet = 'preflop';
    this.pot = 0;
    this.handNumber = 1;
    this.completedHands = 0;
    this.smallBlindSide = 'w';
    this.status = 'active';
    this.streetActions = [];
    this.beginHand();
  }

  turn(): PokerColor {
    return this.currentTurn;
  }

  boardState(): string {
    return [
      `hand:${this.handNumber}`,
      `street:${this.currentStreet}`,
      `pot:${this.pot}`,
      `w_chips:${this.white.chips}`,
      `b_chips:${this.black.chips}`,
      `w_bet:${this.white.streetBet}`,
      `b_bet:${this.black.streetBet}`,
      `community:${formatCards(this.community)}`,
      `w_hole:${formatCards(this.white.hole)}`,
      `b_hole:${formatCards(this.black.hole)}`,
      `turn:${this.currentTurn}`,
    ].join(' ');
  }

  boardForPrompt(side: PokerColor = this.currentTurn): string {
    const self = this.player(side);
    const opponent = this.player(this.other(side));
    const you = side === 'w' ? 'White' : 'Black';
    const villain = side === 'w' ? 'Black' : 'White';
    const blindLabel = this.smallBlindSide === side ? 'Small Blind' : 'Big Blind';
    const history = this.streetActions.length > 0 ? this.streetActions.join(' | ') : 'None yet.';

    return [
      `You are ${you} (${blindLabel}).`,
      `Hand: ${this.handNumber}/${MAX_HANDS}`,
      `Street: ${this.currentStreet}`,
      `Your hole cards: ${self.hole.map(formatCard).join(' ')}`,
      `Community cards: ${this.community.length > 0 ? this.community.map(formatCard).join(' ') : '(none)'}`,
      `Pot: ${this.pot}`,
      `Chip stacks: White ${this.white.chips} | Black ${this.black.chips}`,
      `Current street bets: White ${this.white.streetBet} | Black ${this.black.streetBet}`,
      `To act: ${this.currentTurn === 'w' ? 'White' : 'Black'}`,
      `${villain}'s hole cards are hidden.`,
      `Betting history this street: ${history}`,
      `Your stack: ${self.chips} | Opponent stack: ${opponent.chips}`,
    ].join('\n');
  }

  legalMoves(): PokerAction[] {
    if (this.status !== 'active') return [];

    const actor = this.player(this.currentTurn);
    if (actor.chips <= 0) return [];

    const currentBet = Math.max(this.white.streetBet, this.black.streetBet);
    const toCall = Math.max(0, currentBet - actor.streetBet);
    const moves: PokerAction[] = [];

    if (toCall > 0) {
      moves.push('FOLD', 'CALL');
    } else {
      moves.push('CHECK');
    }

    if (actor.chips > toCall) {
      if (this.canRaise(actor, BIG_BLIND)) moves.push('RAISE_SMALL');
      if (this.canRaise(actor, BIG_BLIND * 3)) moves.push('RAISE_BIG');
      moves.push('ALL_IN');
    } else if (actor.chips === toCall && toCall > 0) {
      moves.push('ALL_IN');
    }

    return ACTIONS.filter((action) => moves.includes(action));
  }

  makeMove(notation: string): { san: string; captured?: string } | null {
    if (this.status !== 'active') return null;

    const move = notation.trim().toUpperCase() as PokerAction;
    if (!this.legalMoves().includes(move)) return null;

    const actorSide = this.currentTurn;
    const actor = this.player(actorSide);
    const opponentSide = this.other(actorSide);
    const currentBet = Math.max(this.white.streetBet, this.black.streetBet);
    const toCall = Math.max(0, currentBet - actor.streetBet);
    const actorName = actorSide === 'w' ? 'White' : 'Black';

    let san = '';
    let captured: string | undefined;

    if (move === 'FOLD') {
      san = `${actorName} folds`;
      this.streetActions.push(san);
      this.awardPot(opponentSide);
      captured = 'pot';
      return { san, captured };
    }

    if (move === 'CHECK') {
      actor.hasActed = true;
      san = `${actorName} checks`;
      this.streetActions.push(san);
      this.advanceAfterAction(actorSide);
      return { san };
    }

    if (move === 'CALL') {
      const committed = this.commit(actorSide, toCall);
      actor.hasActed = true;
      san = `${actorName} calls ${committed}`;
      this.streetActions.push(san);
      this.advanceAfterAction(actorSide);
      return { san };
    }

    if (move === 'RAISE_SMALL' || move === 'RAISE_BIG') {
      const raiseAmount = move === 'RAISE_SMALL' ? BIG_BLIND : BIG_BLIND * 3;
      const targetBet = currentBet + raiseAmount;
      const commitAmount = targetBet - actor.streetBet;
      if (commitAmount > actor.chips) return null;

      this.commit(actorSide, commitAmount);
      actor.hasActed = true;
      this.player(opponentSide).hasActed = false;
      san = `${actorName} raises to ${this.player(actorSide).streetBet}`;
      this.streetActions.push(san);
      this.currentTurn = opponentSide;
      return { san };
    }

    const allInAmount = actor.chips;
    const newTotal = actor.streetBet + allInAmount;
    this.commit(actorSide, allInAmount);
    actor.hasActed = true;

    if (newTotal > currentBet) {
      this.player(opponentSide).hasActed = false;
      san = `${actorName} is all-in to ${this.player(actorSide).streetBet}`;
      this.streetActions.push(san);
      this.currentTurn = opponentSide;
      if (this.player(this.currentTurn).chips <= 0) {
        this.resolveForcedShowdown();
      }
      return { san };
    }

    san = `${actorName} calls all-in for ${allInAmount}`;
    this.streetActions.push(san);
    this.advanceAfterAction(actorSide);
    return { san };
  }

  isGameOver(): boolean {
    return this.status !== 'active';
  }

  gameStatus(): PokerStatus {
    return this.status;
  }

  private createPlayer(chips: number): PlayerState {
    return { chips, hole: [], streetBet: 0, hasActed: false };
  }

  private player(side: PokerColor): PlayerState {
    return side === 'w' ? this.white : this.black;
  }

  private other(side: PokerColor): PokerColor {
    return side === 'w' ? 'b' : 'w';
  }

  private canRaise(actor: PlayerState, raiseBy: number): boolean {
    const currentBet = Math.max(this.white.streetBet, this.black.streetBet);
    const targetBet = currentBet + raiseBy;
    return targetBet > actor.streetBet && actor.chips >= targetBet - actor.streetBet;
  }

  private commit(side: PokerColor, amount: number): number {
    const player = this.player(side);
    const actual = Math.max(0, Math.min(amount, player.chips));
    player.chips -= actual;
    player.streetBet += actual;
    this.pot += actual;
    return actual;
  }

  private beginHand(): void {
    if (this.status !== 'active') return;

    this.deck = shuffle(createDeck());
    this.community = [];
    this.currentStreet = 'preflop';
    this.pot = 0;
    this.streetActions = [];
    this.white.hole = [];
    this.black.hole = [];
    this.white.streetBet = 0;
    this.black.streetBet = 0;
    this.white.hasActed = false;
    this.black.hasActed = false;

    this.white.hole = [this.draw(), this.draw()];
    this.black.hole = [this.draw(), this.draw()];

    const bigBlindSide = this.other(this.smallBlindSide);
    const sbPosted = this.commit(this.smallBlindSide, SMALL_BLIND);
    const bbPosted = this.commit(bigBlindSide, BIG_BLIND);
    this.streetActions.push(`${this.smallBlindSide === 'w' ? 'White' : 'Black'} posts small blind ${sbPosted}`);
    this.streetActions.push(`${bigBlindSide === 'w' ? 'White' : 'Black'} posts big blind ${bbPosted}`);
    this.currentTurn = this.smallBlindSide;

    if (this.player(this.currentTurn).chips <= 0) {
      this.resolveForcedShowdown();
    }
  }

  private draw(): Card {
    const card = this.deck.pop();
    if (!card) {
      throw new Error('Deck exhausted unexpectedly.');
    }
    return card;
  }

  private advanceAfterAction(actorSide: PokerColor): void {
    if (this.status !== 'active') return;

    if (this.player('w').chips <= 0 || this.player('b').chips <= 0) {
      if (this.player(this.other(actorSide)).chips <= 0 || this.betsAreEqual()) {
        this.resolveForcedShowdown();
        return;
      }
    }

    if (this.betsAreEqual() && this.white.hasActed && this.black.hasActed) {
      this.advanceStreet();
      return;
    }

    this.currentTurn = this.other(actorSide);
    if (this.player(this.currentTurn).chips <= 0) {
      this.resolveForcedShowdown();
    }
  }

  private betsAreEqual(): boolean {
    return this.white.streetBet === this.black.streetBet;
  }

  private resolveForcedShowdown(): void {
    this.refundUncalledBet();
    while (this.community.length < 5) {
      this.community.push(this.draw());
    }
    this.currentStreet = 'showdown';
    this.resolveShowdown();
  }

  private refundUncalledBet(): void {
    const difference = Math.abs(this.white.streetBet - this.black.streetBet);
    if (difference === 0) return;

    const higherSide: PokerColor = this.white.streetBet > this.black.streetBet ? 'w' : 'b';
    const player = this.player(higherSide);
    player.streetBet -= difference;
    player.chips += difference;
    this.pot -= difference;
  }

  private advanceStreet(): void {
    this.white.streetBet = 0;
    this.black.streetBet = 0;
    this.white.hasActed = false;
    this.black.hasActed = false;
    this.streetActions = [];

    if (this.currentStreet === 'preflop') {
      this.community.push(this.draw(), this.draw(), this.draw());
      this.currentStreet = 'flop';
      this.currentTurn = this.other(this.smallBlindSide);
      return;
    }

    if (this.currentStreet === 'flop') {
      this.community.push(this.draw());
      this.currentStreet = 'turn';
      this.currentTurn = this.other(this.smallBlindSide);
      return;
    }

    if (this.currentStreet === 'turn') {
      this.community.push(this.draw());
      this.currentStreet = 'river';
      this.currentTurn = this.other(this.smallBlindSide);
      return;
    }

    this.currentStreet = 'showdown';
    this.resolveShowdown();
  }

  private resolveShowdown(): void {
    const whiteRank = evaluateHand([...this.white.hole, ...this.community]);
    const blackRank = evaluateHand([...this.black.hole, ...this.community]);
    const comparison = compareHandRanks(whiteRank, blackRank);

    if (comparison > 0) {
      this.finishHand('w', `White wins showdown ${whiteRank.join('-')} vs ${blackRank.join('-')}`);
      return;
    }

    if (comparison < 0) {
      this.finishHand('b', `Black wins showdown ${blackRank.join('-')} vs ${whiteRank.join('-')}`);
      return;
    }

    this.splitPot();
    this.streetActions.push(`Showdown split pot with board ${formatCards(this.community)}`);
    this.completeHand();
  }

  private awardPot(side: PokerColor): void {
    const winner = this.player(side);
    winner.chips += this.pot;
    this.streetActions.push(`${side === 'w' ? 'White' : 'Black'} wins pot ${this.pot}`);
    this.pot = 0;
    this.completeHand();
  }

  private finishHand(side: PokerColor, summary: string): void {
    const winner = this.player(side);
    winner.chips += this.pot;
    this.streetActions.push(summary);
    this.pot = 0;
    this.completeHand();
  }

  private splitPot(): void {
    const whiteShare = Math.floor(this.pot / 2);
    const blackShare = this.pot - whiteShare;
    this.white.chips += whiteShare;
    this.black.chips += blackShare;
    this.pot = 0;
  }

  private completeHand(): void {
    this.completedHands++;

    if (this.white.chips <= 0 && this.black.chips <= 0) {
      this.status = 'draw';
      return;
    }
    if (this.white.chips <= 0) {
      this.status = 'black_wins';
      return;
    }
    if (this.black.chips <= 0) {
      this.status = 'white_wins';
      return;
    }
    if (this.completedHands >= MAX_HANDS) {
      if (this.white.chips > this.black.chips) this.status = 'white_wins';
      else if (this.black.chips > this.white.chips) this.status = 'black_wins';
      else this.status = 'draw';
      return;
    }

    this.smallBlindSide = this.other(this.smallBlindSide);
    this.handNumber = this.completedHands + 1;
    this.beginHand();
  }
}
