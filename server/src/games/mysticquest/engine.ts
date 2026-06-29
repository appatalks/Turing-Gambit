// ─── Mystic Quest Engine ─────────────────────────────────
// A turn-based dungeon adventure. Two AI heroes cooperate/compete
// through a procedural dungeon: explore rooms, fight monsters,
// collect treasure. Highest treasure score after clearing the dungeon wins.
// White = Warrior, Black = Mage. They alternate actions.

export type MQColor = 'w' | 'b';
export type MQStatus = 'active' | 'white_wins' | 'black_wins' | 'draw';

interface Room {
  id: number;
  type: 'empty' | 'monster' | 'treasure' | 'trap' | 'exit';
  description: string;
  cleared: boolean;
  monsterHP?: number;
  treasureValue?: number;
  trapDamage?: number;
}

export class MysticQuestEngine {
  private rooms: Room[] = [];
  private currentRoom = 0;
  private currentTurn: MQColor = 'w';
  private whiteHP = 20;
  private blackHP = 20;
  private whiteTreasure = 0;
  private blackTreasure = 0;
  private moveCount = 0;
  private maxMoves = 40;
  private dungeonSize = 10;

  constructor() {
    this.generateDungeon();
  }

  private generateDungeon(): void {
    const types: Room['type'][] = ['empty', 'monster', 'treasure', 'trap', 'monster', 'treasure', 'monster', 'trap', 'treasure'];
    // Shuffle room types
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }

    const descriptions: Record<Room['type'], string[]> = {
      empty: ['A dusty corridor', 'An abandoned chamber', 'A quiet hall'],
      monster: ['A goblin lurks here', 'A skeleton warrior blocks the path', 'A shadow beast emerges'],
      treasure: ['A glittering chest sits here', 'Gold coins scatter the floor', 'A jeweled artifact rests on a pedestal'],
      trap: ['Poison darts in the walls', 'A pit trap in the floor', 'A swinging blade mechanism'],
      exit: ['The dungeon exit glows with light'],
    };

    this.rooms = [
      { id: 0, type: 'empty', description: 'The dungeon entrance', cleared: true },
    ];

    for (let i = 0; i < types.length; i++) {
      const t = types[i];
      const descs = descriptions[t];
      const room: Room = {
        id: i + 1,
        type: t,
        description: descs[Math.floor(Math.random() * descs.length)],
        cleared: false,
      };
      if (t === 'monster') room.monsterHP = 3 + Math.floor(Math.random() * 5);
      if (t === 'treasure') room.treasureValue = 5 + Math.floor(Math.random() * 15);
      if (t === 'trap') room.trapDamage = 2 + Math.floor(Math.random() * 4);
      this.rooms.push(room);
    }

    this.rooms.push({ id: this.rooms.length, type: 'exit', description: 'The dungeon exit glows with light', cleared: false });
    this.dungeonSize = this.rooms.length;
  }

  turn(): MQColor {
    return this.currentTurn;
  }

  boardState(): string {
    return `${this.currentRoom}|${this.whiteHP}|${this.blackHP}|${this.whiteTreasure}|${this.blackTreasure}|${this.moveCount}|${this.dungeonSize}|${this.currentTurn}|${this.rooms.map((r) => `${r.type}:${r.cleared ? 1 : 0}`).join(',')}`;
  }

  boardForPrompt(side: MQColor): string {
    const role = side === 'w' ? 'Warrior' : 'Mage';
    const room = this.rooms[this.currentRoom];
    const lines: string[] = [];

    lines.push(`═══ MYSTIC QUEST ═══`);
    lines.push(`You are the ${role} (${side === 'w' ? 'White' : 'Black'})`);
    lines.push(`HP: Warrior=${this.whiteHP} | Mage=${this.blackHP}`);
    lines.push(`Treasure: Warrior=${this.whiteTreasure} | Mage=${this.blackTreasure}`);
    lines.push(`Room ${this.currentRoom + 1}/${this.dungeonSize}: ${room.description}`);
    lines.push(`Move ${this.moveCount}/${this.maxMoves}`);
    lines.push('');

    if (room.type === 'monster' && !room.cleared) {
      lines.push(`⚔ Monster present! HP: ${room.monsterHP}`);
      lines.push(`${role === 'Warrior' ? 'ATTACK deals 3 damage' : 'CAST deals 4 damage but costs 1 HP'}`);
    } else if (room.type === 'treasure' && !room.cleared) {
      lines.push(`💰 Treasure here! Value: ${room.treasureValue}`);
    } else if (room.type === 'trap' && !room.cleared) {
      lines.push(`⚠ Trap detected! Potential damage: ${room.trapDamage}`);
      lines.push(`${role === 'Mage' ? 'DISARM has 100% success' : 'DISARM has 50% success'}`);
    } else if (room.type === 'exit' && !room.cleared) {
      lines.push('🚪 The exit! Step through to end the quest.');
    }

    return lines.join('\n');
  }

  legalMoves(): string[] {
    const room = this.rooms[this.currentRoom];
    const moves: string[] = [];

    if (room.type === 'monster' && !room.cleared) {
      moves.push('ATTACK');
      if (this.currentTurn === 'b') moves.push('CAST'); // Mage can cast
      moves.push('DEFEND');
    } else if (room.type === 'treasure' && !room.cleared) {
      moves.push('COLLECT');
      moves.push('FORWARD');
    } else if (room.type === 'trap' && !room.cleared) {
      moves.push('DISARM');
      moves.push('FORWARD'); // rush through, take damage
    } else if (room.type === 'exit' && !room.cleared) {
      moves.push('EXIT');
    } else {
      if (this.currentRoom < this.dungeonSize - 1) moves.push('FORWARD');
      if (this.currentRoom > 0) moves.push('BACK');
      if (moves.length === 0) moves.push('WAIT');
    }

    return moves;
  }

  makeMove(notation: string): { san: string; captured?: string } | null {
    const move = notation.toUpperCase().trim();
    const room = this.rooms[this.currentRoom];
    const role = this.currentTurn === 'w' ? 'Warrior' : 'Mage';
    let san = '';

    switch (move) {
      case 'ATTACK': {
        if (room.type !== 'monster' || room.cleared) return null;
        const dmg = this.currentTurn === 'w' ? 3 : 2;
        room.monsterHP! -= dmg;
        san = `${role} attacks for ${dmg} damage`;
        if (room.monsterHP! <= 0) {
          room.cleared = true;
          san += ' — Monster slain!';
        }
        break;
      }
      case 'CAST': {
        if (this.currentTurn !== 'b' || room.type !== 'monster' || room.cleared) return null;
        room.monsterHP! -= 4;
        this.blackHP -= 1; // mana cost
        san = `Mage casts spell for 4 damage (costs 1 HP)`;
        if (room.monsterHP! <= 0) {
          room.cleared = true;
          san += ' — Monster slain!';
        }
        break;
      }
      case 'DEFEND': {
        if (room.type !== 'monster' || room.cleared) return null;
        san = `${role} defends (monster attacks for reduced damage)`;
        // Monster retaliates but for less
        const retaliation = 1;
        if (this.currentTurn === 'w') this.whiteHP -= retaliation;
        else this.blackHP -= retaliation;
        break;
      }
      case 'COLLECT': {
        if (room.type !== 'treasure' || room.cleared) return null;
        const value = room.treasureValue!;
        if (this.currentTurn === 'w') this.whiteTreasure += value;
        else this.blackTreasure += value;
        room.cleared = true;
        san = `${role} collects ${value} treasure!`;
        break;
      }
      case 'DISARM': {
        if (room.type !== 'trap' || room.cleared) return null;
        const success = this.currentTurn === 'b' ? true : Math.random() > 0.5;
        if (success) {
          room.cleared = true;
          san = `${role} disarms the trap!`;
        } else {
          const dmg = room.trapDamage!;
          if (this.currentTurn === 'w') this.whiteHP -= dmg;
          else this.blackHP -= dmg;
          room.cleared = true;
          san = `${role} fails to disarm — takes ${dmg} damage!`;
        }
        break;
      }
      case 'FORWARD': {
        if (this.currentRoom >= this.dungeonSize - 1) return null;
        if (room.type === 'trap' && !room.cleared) {
          // Rush through trap
          const dmg = room.trapDamage!;
          if (this.currentTurn === 'w') this.whiteHP -= dmg;
          else this.blackHP -= dmg;
          room.cleared = true;
          san = `${role} rushes through trap (${dmg} damage) and moves forward`;
        } else {
          san = `${role} moves forward`;
        }
        this.currentRoom++;
        break;
      }
      case 'BACK': {
        if (this.currentRoom <= 0) return null;
        this.currentRoom--;
        san = `${role} retreats`;
        break;
      }
      case 'EXIT': {
        if (room.type !== 'exit') return null;
        room.cleared = true;
        san = `${role} exits the dungeon!`;
        break;
      }
      case 'WAIT': {
        san = `${role} waits`;
        break;
      }
      default:
        return null;
    }

    this.moveCount++;
    this.currentTurn = this.currentTurn === 'w' ? 'b' : 'w';
    return { san };
  }

  isGameOver(): boolean {
    return this.gameStatus() !== 'active';
  }

  gameStatus(): MQStatus {
    // Check if heroes are dead
    if (this.whiteHP <= 0 && this.blackHP <= 0) return 'draw';
    if (this.whiteHP <= 0) return 'black_wins';
    if (this.blackHP <= 0) return 'white_wins';

    // Check if exit reached
    const exitRoom = this.rooms[this.rooms.length - 1];
    if (exitRoom.cleared || this.moveCount >= this.maxMoves) {
      if (this.whiteTreasure > this.blackTreasure) return 'white_wins';
      if (this.blackTreasure > this.whiteTreasure) return 'black_wins';
      return 'draw';
    }

    return 'active';
  }

  getMoveCount(): number {
    return this.moveCount;
  }
}
