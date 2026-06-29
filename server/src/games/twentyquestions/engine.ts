export type TQColor = 'w' | 'b';
export type TQStatus = 'active' | 'white_wins' | 'black_wins';
type TQAnswer = 'YES' | 'NO' | 'SOMETIMES' | 'CORRECT' | 'WRONG';
type TQPhase = 'ask' | 'answer';

interface TQHistoryEntry {
  kind: 'ask' | 'guess';
  prompt: string;
  answer: TQAnswer;
}

const MAX_QUESTIONS = 20;

const SECRET_WORDS = [
  'elephant', 'penguin', 'octopus', 'eagle', 'dolphin', 'butterfly', 'chameleon', 'giraffe', 'kangaroo', 'panda',
  'tiger', 'wolf', 'owl', 'shark', 'whale', 'camel', 'koala', 'raccoon', 'peacock', 'squirrel',
  'piano', 'telescope', 'umbrella', 'lighthouse', 'compass', 'hourglass', 'bicycle', 'backpack', 'camera', 'helmet',
  'lantern', 'microscope', 'notebook', 'magnet', 'rocket', 'suitcase', 'key', 'mirror', 'hammer', 'toothbrush',
  'pizza', 'sushi', 'chocolate', 'avocado', 'pretzel', 'pancake', 'popcorn', 'cheesecake', 'taco', 'noodle',
  'croissant', 'dumpling', 'lasagna', 'blueberry', 'coconut', 'waffle', 'carrot', 'ice cream', 'sandwich', 'cookie',
  'volcano', 'library', 'pyramid', 'rainforest', 'castle', 'island', 'desert', 'waterfall', 'museum', 'canyon',
  'harbor', 'igloo', 'subway', 'bridge', 'moon', 'planetarium', 'observatory', 'temple', 'stadium', 'lighthouse',
  'gravity', 'democracy', 'jazz', 'photography', 'origami', 'electricity', 'friendship', 'history', 'poetry', 'mathematics',
  'internet', 'time travel', 'eiffel tower', 'great wall', 'treasure map', 'snowflake', 'rainbow', 'volleyball', 'fireworks', 'robot',
];

function randomSecret(): string {
  return SECRET_WORDS[Math.floor(Math.random() * SECRET_WORDS.length)];
}

function normalizeGuess(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(?:a|an|the)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function singularize(value: string): string {
  return value.endsWith('s') && !value.endsWith('ss') ? value.slice(0, -1) : value;
}

function fuzzyMatchesSecret(guess: string, secret: string): boolean {
  const normalizedGuess = normalizeGuess(guess);
  const normalizedSecret = normalizeGuess(secret);
  if (!normalizedGuess || !normalizedSecret) return false;
  return normalizedGuess === normalizedSecret
    || singularize(normalizedGuess) === singularize(normalizedSecret);
}

function formatHistory(entries: TQHistoryEntry[]): string {
  if (entries.length === 0) return 'None yet.';
  return entries
    .map((entry, index) => (
      entry.kind === 'ask'
        ? `${index + 1}. ${entry.prompt} → ${entry.answer}`
        : `${index + 1}. Guess: ${entry.prompt} → ${entry.answer}`
    ))
    .join('\n');
}

function serializeHistory(entries: TQHistoryEntry[]): string {
  if (entries.length === 0) return '-';
  return entries
    .map((entry) => {
      const prompt = entry.kind === 'guess' ? `GUESS:${entry.prompt}` : entry.prompt;
      return `${prompt.replace(/,/g, ';').replace(/\s+/g, ' ').trim()}?${entry.answer}`;
    })
    .join(',');
}

export class TwentyQuestionsEngine {
  private secret = '';
  private questionsRemaining = MAX_QUESTIONS;
  private history: TQHistoryEntry[] = [];
  private currentTurn: TQColor = 'b';
  private pendingQuestion: string | null = null;
  private status: TQStatus = 'active';

  constructor() {
    this.reset();
  }

  reset(): void {
    this.secret = randomSecret();
    this.questionsRemaining = MAX_QUESTIONS;
    this.history = [];
    this.currentTurn = 'b';
    this.pendingQuestion = null;
    this.status = 'active';
  }

  turn(): TQColor {
    return this.currentTurn;
  }

  boardState(): string {
    return `secret:${this.secret.toUpperCase()} questions:${this.questionsRemaining} phase:${this.phase()} history:${serializeHistory(this.history)} turn:${this.currentTurn}`;
  }

  boardForPrompt(side: TQColor = this.currentTurn): string {
    const lines: string[] = [];
    if (side === 'w') {
      lines.push(`You are the Answerer. The secret word is: ${this.secret.toUpperCase()}`);
    } else {
      lines.push('You are the Questioner trying to guess the secret word.');
    }

    lines.push('', 'Q&A so far:', formatHistory(this.history), '', `Questions remaining: ${this.questionsRemaining}`, '');

    if (side === 'w') {
      if (this.pendingQuestion) {
        lines.push(`The questioner just asked: "${this.pendingQuestion}"`);
        lines.push('Answer YES, NO, or SOMETIMES.');
      } else {
        lines.push('Wait for the next question or guess.');
      }
    } else if (this.pendingQuestion) {
      lines.push(`Waiting for the Answerer to respond to: "${this.pendingQuestion}"`);
    } else {
      lines.push('Ask a yes/no question or make a guess.');
    }

    return lines.join('\n');
  }

  legalMoves(): string[] {
    if (this.status !== 'active') return [];
    return this.currentTurn === 'b' ? ['ASK', 'GUESS'] : ['YES', 'NO', 'SOMETIMES'];
  }

  makeMove(notation: string): { san: string; captured?: string } | null {
    if (this.status !== 'active') return null;

    if (this.currentTurn === 'b') {
      const move = this.parseBlackMove(notation);
      if (!move) return null;

      if (move.kind === 'ask') {
        this.pendingQuestion = move.value;
        this.currentTurn = 'w';
        return { san: `ASK: ${move.value}` };
      }

      const answer: TQAnswer = fuzzyMatchesSecret(move.value, this.secret) ? 'CORRECT' : 'WRONG';
      this.history.push({ kind: 'guess', prompt: move.value, answer });
      this.questionsRemaining = Math.max(0, this.questionsRemaining - 1);

      if (answer === 'CORRECT') {
        this.status = 'black_wins';
      } else if (this.questionsRemaining === 0) {
        this.status = 'white_wins';
      }

      return { san: `GUESS: ${move.value} → ${answer}` };
    }

    const answer = this.parseWhiteMove(notation);
    if (!answer || !this.pendingQuestion) return null;

    this.history.push({ kind: 'ask', prompt: this.pendingQuestion, answer });
    this.pendingQuestion = null;
    this.questionsRemaining = Math.max(0, this.questionsRemaining - 1);

    if (this.questionsRemaining === 0) {
      this.status = 'white_wins';
    } else {
      this.currentTurn = 'b';
    }

    return { san: `ANSWER: ${answer}` };
  }

  isGameOver(): boolean {
    return this.status !== 'active';
  }

  gameStatus(): TQStatus {
    return this.status;
  }

  private phase(): TQPhase {
    return this.currentTurn === 'b' ? 'ask' : 'answer';
  }

  private parseBlackMove(notation: string): { kind: 'ask' | 'guess'; value: string } | null {
    const text = notation.trim();
    const match = text.match(/^(ASK|GUESS)\s*:\s*(.+)$/i);
    if (!match) return null;

    const kind = match[1].toLowerCase() as 'ask' | 'guess';
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    if (!value) return null;

    if (kind === 'ask') {
      const question = /[?]$/.test(value) ? value : `${value}?`;
      return { kind, value: question };
    }

    return { kind, value };
  }

  private parseWhiteMove(notation: string): TQAnswer | null {
    const upper = notation.trim().toUpperCase();
    if (upper === 'YES' || upper === 'NO' || upper === 'SOMETIMES') return upper;
    return null;
  }
}
