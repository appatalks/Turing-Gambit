// ─── 20 Questions Engine ─────────────────────────────────
// Asymmetric: White = Answerer (picks a secret), Black = Questioner.
// Questioner asks yes/no questions, Answerer responds Y/N.
// Questioner can guess at any time. 20 questions max.

export type TQColor = 'w' | 'b';
export type TQStatus = 'active' | 'white_wins' | 'black_wins' | 'draw';

interface QA {
  question: string;
  answer: string;
}

export class TwentyQuestionsEngine {
  private secret: string = '';
  private history: QA[] = [];
  private currentTurn: TQColor = 'w'; // w picks secret first, then b asks questions and w responds
  private phase: 'pick_secret' | 'question' | 'answer' | 'done' = 'pick_secret';
  private questionCount = 0;
  private guessResult: 'correct' | 'wrong' | null = null;
  private pendingQuestion = '';
  private maxQuestions = 20;

  turn(): TQColor {
    return this.currentTurn;
  }

  boardState(): string {
    // Format: phase|questionCount|historyJSON|turn
    const hist = this.history.map((h) => `${h.question}=${h.answer}`).join(';');
    return `${this.phase}|${this.questionCount}|${hist}|${this.currentTurn}|${this.guessResult || ''}`;
  }

  boardForPrompt(side: TQColor): string {
    const lines: string[] = [];

    if (this.phase === 'pick_secret') {
      if (side === 'w') {
        lines.push('You are the ANSWERER. Pick a secret thing (animal, object, person, or place).');
        lines.push('Reply with SECRET: <your secret>');
      } else {
        lines.push('Waiting for the Answerer to pick a secret...');
      }
      return lines.join('\n');
    }

    lines.push(`20 Questions — ${this.questionCount}/${this.maxQuestions} questions used`);
    lines.push('');

    if (this.history.length > 0) {
      lines.push('Question history:');
      for (let i = 0; i < this.history.length; i++) {
        lines.push(`  Q${i + 1}: ${this.history[i].question} → ${this.history[i].answer}`);
      }
      lines.push('');
    }

    if (side === 'w') {
      // Answerer sees the secret
      lines.push(`Your secret: "${this.secret}"`);
      if (this.phase === 'answer') {
        lines.push(`\nQuestion asked: "${this.pendingQuestion}"`);
        lines.push('Answer YES or NO (or if it\'s a guess, CORRECT or WRONG).');
      }
    } else {
      // Questioner does NOT see the secret
      if (this.phase === 'question') {
        lines.push(`Questions remaining: ${this.maxQuestions - this.questionCount}`);
        lines.push('Ask a yes/no question, or make a guess.');
      }
    }

    return lines.join('\n');
  }

  legalMoves(): string[] {
    if (this.phase === 'pick_secret') return ['SECRET'];
    if (this.phase === 'question') return ['ASK', 'GUESS'];
    if (this.phase === 'answer') return ['YES', 'NO', 'CORRECT', 'WRONG'];
    return [];
  }

  makeMove(notation: string): { san: string; captured?: string } | null {
    if (this.phase === 'pick_secret') {
      const m = notation.match(/^SECRET:\s*(.+)$/i);
      if (!m) return null;
      this.secret = m[1].trim();
      this.phase = 'question';
      this.currentTurn = 'b'; // questioner's turn
      return { san: `Secret chosen` };
    }

    if (this.phase === 'question') {
      const askMatch = notation.match(/^ASK:\s*(.+)$/i);
      const guessMatch = notation.match(/^GUESS:\s*(.+)$/i);

      if (askMatch) {
        this.pendingQuestion = askMatch[1].trim();
        this.questionCount++;
        this.phase = 'answer';
        this.currentTurn = 'w'; // answerer responds
        return { san: `Q${this.questionCount}: ${this.pendingQuestion}` };
      }

      if (guessMatch) {
        this.pendingQuestion = guessMatch[1].trim();
        this.questionCount++;
        this.phase = 'answer';
        this.currentTurn = 'w'; // answerer confirms
        return { san: `GUESS: ${this.pendingQuestion}` };
      }

      return null;
    }

    if (this.phase === 'answer') {
      const upper = notation.toUpperCase().trim();
      if (upper === 'YES' || upper === 'NO') {
        this.history.push({ question: this.pendingQuestion, answer: upper });
        this.pendingQuestion = '';

        if (this.questionCount >= this.maxQuestions) {
          this.phase = 'done';
          this.guessResult = 'wrong'; // ran out of questions
        } else {
          this.phase = 'question';
          this.currentTurn = 'b';
        }
        return { san: upper };
      }

      if (upper === 'CORRECT') {
        this.history.push({ question: this.pendingQuestion, answer: 'CORRECT!' });
        this.guessResult = 'correct';
        this.phase = 'done';
        return { san: `CORRECT! The answer was "${this.secret}"` };
      }

      if (upper === 'WRONG') {
        this.history.push({ question: this.pendingQuestion, answer: 'WRONG' });
        this.pendingQuestion = '';

        if (this.questionCount >= this.maxQuestions) {
          this.phase = 'done';
          this.guessResult = 'wrong';
        } else {
          this.phase = 'question';
          this.currentTurn = 'b';
        }
        return { san: `WRONG` };
      }

      return null;
    }

    return null;
  }

  isGameOver(): boolean {
    return this.phase === 'done';
  }

  gameStatus(): TQStatus {
    if (!this.isGameOver()) return 'active';
    if (this.guessResult === 'correct') return 'black_wins'; // questioner guessed it
    return 'white_wins'; // answerer survived
  }

  getMoveCount(): number {
    return this.questionCount;
  }
}
