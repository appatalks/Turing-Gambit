/**
 * Hitchhiker's Guide to the Galaxy — Dual-instance text adventure race.
 * Inspired by the Infocom classic. Each player races through the opening
 * sequence: wake up, survive bulldozer, get on Vogon ship, escape.
 * First to reach the Heart of Gold wins. Highest progress at turn limit wins.
 */

export type HHColor = 'w' | 'b';
export type HHStatus = 'active' | 'white_wins' | 'black_wins' | 'draw';

interface Room {
  name: string;
  description: string;
  exits: Partial<Record<string, string>>;
  items?: string[];
  dark?: boolean;
}

interface Item {
  name: string;
  description: string;
  takeable?: boolean;
}

interface PlayerState {
  room: string;
  inventory: string[];
  score: number;
  turns: number;
  lastOutput: string;
  flags: Record<string, boolean>;
  rooms: Record<string, Room>;
  items: Record<string, Item>;
}

const WIN_SCORE = 50;
const MAX_TURNS = 120;

function createRooms(): Record<string, Room> {
  return {
    'bedroom': {
      name: 'Bedroom',
      description: 'You wake up. The room spins. Your mouth tastes like the inside of an old shoe. There is a flatscreen display showing LOCAL NEWS, a phone next to your bed, and a dressing gown hanging on the door. It is Thursday.',
      exits: { south: 'front-porch' },
      items: ['dressing-gown', 'phone', 'aspirin'],
    },
    'front-porch': {
      name: 'Front of House',
      description: 'You are standing outside your house. A large yellow bulldozer is parked outside, ready to demolish your house to make way for a new bypass. Mr. Prosser, wearing a hard hat, stands nearby looking impatient. Ford Prefect is here, looking nervous.',
      exits: { north: 'bedroom', south: 'pub', east: 'garden' },
      items: ['towel'],
    },
    'garden': {
      name: 'Garden',
      description: 'A small garden behind the house. Some scrubby grass and a few sad-looking flowers. There is no way the bulldozer can reach here.',
      exits: { west: 'front-porch' },
    },
    'pub': {
      name: 'The Horse and Groom',
      description: 'A small, dingy pub. Ford Prefect has followed you here and is ordering six pints of bitter. He seems to be trying to tell you something important about the end of the world.',
      exits: { north: 'front-porch' },
      items: ['peanuts', 'beer'],
    },
    'lying-in-mud': {
      name: 'Lying in Mud',
      description: 'You are lying in front of the bulldozer. Mr. Prosser looks confused. Ford Prefect is talking fast about something called a "sub-etha sens-o-matic." The sky looks oddly yellow.',
      exits: {},
    },
    'vogon-hold': {
      name: 'Vogon Hold',
      description: 'You are in the hold of a Vogon Constructor Fleet ship. The walls are a sickly green. There is a Vogon Guard here. A small access panel is visible on the wall. The guard is reading poetry.',
      exits: { east: 'vogon-corridor' },
      items: ['babel-fish-dispenser'],
    },
    'vogon-corridor': {
      name: 'Vogon Corridor',
      description: 'A long, unpleasant corridor. Signs in Vogon read things that probably mean "DANGER" and "NO HITCHHIKING." There is an airlock to the east.',
      exits: { west: 'vogon-hold', east: 'airlock' },
    },
    'airlock': {
      name: 'Airlock',
      description: 'You are in the Vogon airlock. The Vogon Captain is here, having just finished reading his poetry. He looks displeased that you didn\'t appreciate it. A button marked "EJECT" is on the wall. Through the porthole you can see infinite space.',
      exits: { west: 'vogon-corridor' },
      items: ['eject-button'],
    },
    'infinite-space': {
      name: 'Deep Space',
      description: 'You are tumbling through infinite space. The stars are very pretty but you can\'t breathe. Unless something very improbable happens in the next 30 seconds, you will die. Fortunately, something very improbable is happening...',
      exits: { improbable: 'heart-of-gold' },
    },
    'heart-of-gold': {
      name: 'Heart of Gold',
      description: 'You are aboard the Heart of Gold, powered by the Infinite Improbability Drive! Zaphod Beeblebrox waves at you with one of his three arms. Trillian is here. Marvin the Paranoid Android stands in the corner, looking depressed. You\'ve made it!',
      exits: {},
    },
  };
}

function createItems(): Record<string, Item> {
  return {
    'dressing-gown': { name: 'dressing gown', description: 'A faded blue dressing gown. It has pockets.', takeable: true },
    'phone': { name: 'phone', description: 'A phone. It might ring.', takeable: false },
    'aspirin': { name: 'aspirin', description: 'Buffered analgesic. Good for hangovers.', takeable: true },
    'towel': { name: 'towel', description: 'A large, fluffy towel. The most massively useful thing an interstellar hitchhiker can have.', takeable: true },
    'peanuts': { name: 'peanuts', description: 'A small packet of salted peanuts. Good for protein and salt.', takeable: true },
    'beer': { name: 'beer', description: 'Three pints of bitter. Ford says you should drink them quickly.', takeable: true },
    'babel-fish-dispenser': { name: 'Babel Fish dispenser', description: 'A small machine on the wall. It dispenses a small yellow fish that translates languages when placed in your ear.', takeable: false },
    'babel-fish': { name: 'Babel Fish', description: 'A small, yellow, leech-like fish. Allows you to understand any language in the universe.', takeable: true },
    'eject-button': { name: 'EJECT button', description: 'A large red button marked EJECT.', takeable: false },
    'sub-etha-device': { name: 'Sub-Etha Sens-O-Matic', description: 'Ford\'s electronic thumb for hitching rides on passing spaceships.', takeable: true },
  };
}

function createPlayerState(): PlayerState {
  return {
    room: 'bedroom',
    inventory: [],
    score: 0,
    turns: 0,
    lastOutput: '',
    flags: {},
    rooms: createRooms(),
    items: createItems(),
  };
}

export class HitchhikerEngine {
  private white: PlayerState;
  private black: PlayerState;
  private currentTurn: HHColor = 'w';
  private status: HHStatus = 'active';
  private totalMoves = 0;

  constructor() {
    this.white = createPlayerState();
    this.black = createPlayerState();
    this.white.lastOutput = this.describe(this.white);
    this.black.lastOutput = this.describe(this.black);
  }

  reset(): void {
    this.white = createPlayerState();
    this.black = createPlayerState();
    this.white.lastOutput = this.describe(this.white);
    this.black.lastOutput = this.describe(this.black);
    this.currentTurn = 'w';
    this.status = 'active';
    this.totalMoves = 0;
  }

  turn(): HHColor { return this.currentTurn; }

  boardState(): string {
    return [
      `turn=${this.currentTurn}`,
      `moves=${this.totalMoves}`,
      `w_score=${this.white.score}`,
      `b_score=${this.black.score}`,
      `w_room=${this.white.room}`,
      `b_room=${this.black.room}`,
      `w_output=${encodeURIComponent(this.white.lastOutput)}`,
      `b_output=${encodeURIComponent(this.black.lastOutput)}`,
    ].join('|');
  }

  boardForPrompt(side: HHColor): string {
    const p = side === 'w' ? this.white : this.black;
    const opp = side === 'w' ? this.black : this.white;
    return [
      `=== HITCHHIKER'S GUIDE TO THE GALAXY ===`,
      `Progress: ${p.score}/${WIN_SCORE} | Turns: ${p.turns} | Opponent progress: ${opp.score}`,
      '',
      p.lastOutput,
      '',
      `Inventory: ${p.inventory.length > 0 ? p.inventory.map((id) => p.items[id]?.name || id).join(', ') : 'empty'}`,
    ].join('\n');
  }

  legalMoves(): string[] {
    return ['LOOK', 'INVENTORY', 'NORTH', 'SOUTH', 'EAST', 'WEST', 'TAKE', 'DROP', 'EXAMINE', 'DRINK', 'LIE DOWN', 'USE', 'PUSH', 'WAIT'];
  }

  makeMove(notation: string): { san: string; captured?: string } | null {
    if (this.status !== 'active') return null;
    const p = this.currentTurn === 'w' ? this.white : this.black;
    const cmd = notation.trim();
    if (!cmd) return null;

    const output = this.executeCommand(p, cmd);
    p.lastOutput = output;
    p.turns++;
    this.totalMoves++;

    this.checkEndConditions();
    if (this.status === 'active') this.currentTurn = this.currentTurn === 'w' ? 'b' : 'w';

    return { san: `${cmd} → ${output.split('\n')[0].slice(0, 60)}` };
  }

  isGameOver(): boolean { return this.status !== 'active'; }
  gameStatus(): HHStatus { return this.status; }

  private executeCommand(p: PlayerState, raw: string): string {
    const words = raw.toUpperCase().replace(/[^A-Z\s]/g, '').split(/\s+/);
    const verb = words[0];
    const rest = words.slice(1).join(' ');

    switch (verb) {
      case 'LOOK': case 'L': return this.describe(p);
      case 'INVENTORY': case 'I': return this.doInventory(p);
      case 'N': case 'NORTH': return this.doGo(p, 'north');
      case 'S': case 'SOUTH': return this.doGo(p, 'south');
      case 'E': case 'EAST': return this.doGo(p, 'east');
      case 'W': case 'WEST': return this.doGo(p, 'west');
      case 'GO': return this.doGo(p, rest.toLowerCase());
      case 'TAKE': case 'GET': return this.doTake(p, rest);
      case 'DROP': return this.doDrop(p, rest);
      case 'EXAMINE': case 'X': case 'READ': return this.doExamine(p, rest);
      case 'DRINK': return this.doDrink(p, rest);
      case 'LIE': return this.doLieDown(p);
      case 'USE': case 'PUSH': case 'PRESS': return this.doUse(p, rest);
      case 'WAIT': case 'Z': return this.doWait(p);
      default: return `I don't know how to "${raw}". Try: LOOK, GO direction, TAKE item, EXAMINE item, DRINK, LIE DOWN, USE item, WAIT.`;
    }
  }

  private describe(p: PlayerState): string {
    const room = p.rooms[p.room];
    if (!room) return 'Void.';
    const lines = [room.name, room.description];
    const items = (room.items || []).filter((id) => p.items[id]?.takeable);
    if (items.length > 0) lines.push(`You can see: ${items.map((id) => p.items[id].name).join(', ')}.`);
    const exits = Object.keys(room.exits);
    if (exits.length > 0) lines.push(`Exits: ${exits.join(', ')}`);
    return lines.join('\n');
  }

  private doInventory(p: PlayerState): string {
    if (p.inventory.length === 0) return 'You are carrying nothing. Not even a towel. Shameful.';
    return `You have:\n${p.inventory.map((id) => `  ${p.items[id]?.name || id}`).join('\n')}`;
  }

  private doGo(p: PlayerState, dir: string): string {
    const room = p.rooms[p.room];
    if (!room) return 'You can\'t go anywhere.';

    // Special: can't leave front-porch south until you lie down
    if (p.room === 'front-porch' && dir === 'south' && !p.flags['bulldozer-handled']) {
      return 'You can\'t just leave! The bulldozer is about to demolish your house! Maybe you should LIE DOWN in front of it, or talk to Ford.';
    }

    const dest = room.exits[dir];
    if (!dest) return 'You can\'t go that way.';

    // Vogon corridor east requires babel fish
    if (p.room === 'vogon-corridor' && dir === 'east' && !p.flags['has-babel-fish']) {
      return 'The Vogon guard stops you. You can\'t understand what he\'s saying. If only you had some kind of universal translator...';
    }

    p.room = dest;

    // Score progression
    if (dest === 'vogon-hold' && !p.flags['scored-vogon']) {
      p.flags['scored-vogon'] = true;
      p.score += 15;
    }
    if (dest === 'airlock' && !p.flags['scored-airlock']) {
      p.flags['scored-airlock'] = true;
      p.score += 10;
    }
    if (dest === 'heart-of-gold') {
      p.score = WIN_SCORE;
    }

    return this.describe(p);
  }

  private doTake(p: PlayerState, target: string): string {
    const id = this.findItem(p, target, 'room');
    if (!id) return 'You can\'t see that here.';
    const item = p.items[id];
    if (!item?.takeable) {
      if (id === 'babel-fish-dispenser') return this.tryBabelFish(p);
      if (id === 'eject-button') return 'That\'s a button, not something you can take. Try PUSH or USE it.';
      return `You can't take the ${item?.name || target}.`;
    }
    const room = p.rooms[p.room];
    if (room.items) room.items = room.items.filter((i) => i !== id);
    p.inventory.push(id);

    // Score towel
    if (id === 'towel' && !p.flags['scored-towel']) {
      p.flags['scored-towel'] = true;
      p.score += 5;
      return `Taken: ${item.name}. A wise choice. A towel is about the most massively useful thing.`;
    }
    return `Taken: ${item.name}.`;
  }

  private doDrop(p: PlayerState, target: string): string {
    const id = this.findItem(p, target, 'inventory');
    if (!id) return 'You don\'t have that.';
    p.inventory = p.inventory.filter((i) => i !== id);
    const room = p.rooms[p.room];
    if (!room.items) room.items = [];
    room.items.push(id);
    return `Dropped: ${p.items[id]?.name || id}.`;
  }

  private doExamine(p: PlayerState, target: string): string {
    const id = this.findItem(p, target, 'any');
    if (!id) return 'You can\'t see that.';
    return p.items[id]?.description || 'Nothing special.';
  }

  private doDrink(p: PlayerState, _target: string): string {
    if (!p.inventory.includes('beer') && !(p.rooms[p.room]?.items || []).includes('beer')) {
      return 'You have nothing to drink.';
    }
    if (p.inventory.includes('beer')) p.inventory = p.inventory.filter((i) => i !== 'beer');
    else {
      const room = p.rooms[p.room];
      if (room.items) room.items = room.items.filter((i) => i !== 'beer');
    }
    if (!p.flags['drank-beer']) {
      p.flags['drank-beer'] = true;
      p.score += 5;
    }
    return 'You drink the beer. All three pints. Ford says "Muscle relaxant. You\'ll need it." The sky turns a peculiar shade of yellow-green.';
  }

  private doLieDown(p: PlayerState): string {
    if (p.room !== 'front-porch') return 'There\'s no reason to lie down here.';
    if (p.flags['bulldozer-handled']) return 'You already dealt with the bulldozer.';
    p.flags['bulldozer-handled'] = true;
    p.room = 'lying-in-mud';
    p.score += 10;

    // Ford gives you sub-etha device
    p.inventory.push('sub-etha-device');
    p.flags['has-sub-etha'] = true;

    return 'You lie down in the mud in front of the bulldozer. Mr. Prosser is confused into lying down in your place. Ford grabs you and says "We need to go to the pub. NOW. Here, take this." He hands you his Sub-Etha Sens-O-Matic.\n\nExits: pub';
  }

  private doUse(p: PlayerState, target: string): string {
    const normalized = target.toLowerCase();

    if (normalized.includes('eject') || normalized.includes('button')) {
      if (p.room !== 'airlock') return 'There\'s no button here.';
      if (!p.flags['has-towel-ready'] && !p.inventory.includes('towel')) {
        return 'You press EJECT. You are flung into space. Without a towel to wrap around your head, you die almost instantly. DON\'T PANIC.\n\n(Actually, do panic. You need your towel.)';
      }
      p.flags['ejected'] = true;
      p.room = 'infinite-space';
      p.score += 10;
      // Auto-transition to heart of gold if they have sub-etha device
      if (p.inventory.includes('sub-etha-device')) {
        p.room = 'heart-of-gold';
        p.score = WIN_SCORE;
        return 'You press EJECT! You\'re flung into space, towel wrapped firmly around your head. The Sub-Etha Sens-O-Matic activates, broadcasting a distress signal. The Infinite Improbability Drive picks you up!\n\nYou are aboard the Heart of Gold! YOU WIN!';
      }
      p.rooms['infinite-space'].exits = { improbable: 'heart-of-gold' };
      return 'You press EJECT! You\'re flung into space, towel wrapped around your head. You float in the void... If only you had Ford\'s device to signal for a ride...\n\nExits: improbable';
    }

    if (normalized.includes('sub') || normalized.includes('device') || normalized.includes('sens')) {
      if (!p.inventory.includes('sub-etha-device')) return 'You don\'t have that.';
      if (p.room === 'infinite-space') {
        p.room = 'heart-of-gold';
        p.score = WIN_SCORE;
        return 'You activate the Sub-Etha Sens-O-Matic! A passing starship detects your signal. The Infinite Improbability Drive whisks you aboard!\n\nYou are aboard the Heart of Gold! YOU WIN!';
      }
      return 'The device blinks. It\'s not detecting any ships nearby. Maybe in space it would work.';
    }

    return `You can't figure out how to use that here.`;
  }

  private doWait(p: PlayerState): string {
    if (p.room === 'lying-in-mud') {
      p.rooms['lying-in-mud'].exits = { south: 'pub' };
      return 'Time passes. The sky grows more yellow. Ford is gesturing frantically toward the pub.\n\nExits: south';
    }
    if (p.room === 'pub' && p.flags['drank-beer'] && !p.flags['vogon-arrived']) {
      p.flags['vogon-arrived'] = true;
      p.room = 'vogon-hold';
      p.score += 15;
      return 'BANG. The world ends. The Vogon Constructor Fleet demolishes Earth. But Ford activated his Sub-Etha device just in time — you\'ve been teleported aboard a Vogon ship!\n\n' + this.describe(p);
    }
    return 'Time passes. Nothing obvious happens.';
  }

  private tryBabelFish(p: PlayerState): string {
    if (p.flags['has-babel-fish']) return 'You already have a Babel Fish.';
    if (p.inventory.includes('towel')) {
      p.flags['has-babel-fish'] = true;
      p.inventory.push('babel-fish');
      p.score += 5;
      return 'You hold your towel under the dispenser and catch the Babel Fish! You put it in your ear. Suddenly you can understand Vogon. (It\'s not an improvement.)';
    }
    return 'A small fish pops out of the dispenser but bounces away before you can catch it. If only you had something to catch it with... like a towel.';
  }

  private findItem(p: PlayerState, target: string, where: 'room' | 'inventory' | 'any'): string | null {
    const normalized = target.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    if (!normalized) return null;
    const check = (id: string) => {
      const item = p.items[id];
      if (!item) return false;
      return item.name.toLowerCase().includes(normalized) || id.includes(normalized.replace(/\s+/g, '-'));
    };
    if (where === 'inventory' || where === 'any') {
      const found = p.inventory.find(check);
      if (found) return found;
    }
    if (where === 'room' || where === 'any') {
      const found = (p.rooms[p.room]?.items || []).find(check);
      if (found) return found;
    }
    return null;
  }

  private checkEndConditions(): void {
    if (this.white.score >= WIN_SCORE) this.status = 'white_wins';
    else if (this.black.score >= WIN_SCORE) this.status = 'black_wins';
    else if (this.totalMoves >= MAX_TURNS * 2) {
      if (this.white.score > this.black.score) this.status = 'white_wins';
      else if (this.black.score > this.white.score) this.status = 'black_wins';
      else this.status = 'draw';
    }
  }
}
