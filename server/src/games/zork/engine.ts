/**
 * Zork 1 Speedrun — Dual-instance text adventure race.
 * Each player has their own independent Zork game.
 * First to reach WIN_SCORE (all treasures in trophy case) wins.
 * If neither wins within MAX_TURNS, highest score wins.
 * Inspired by the open-source Zork 1 (historicalsource/zork1).
 */

export type ZorkColor = 'w' | 'b';
export type ZorkStatus = 'active' | 'white_wins' | 'black_wins' | 'draw';

// ─── World Data ─────────────────────────────────────────

interface Room {
  name: string;
  description: string;
  exits: Partial<Record<Direction, string>>;
  dark?: boolean;
  items?: string[];
  blocked?: { dir: Direction; by: string; message: string };
}

type Direction = 'north' | 'south' | 'east' | 'west' | 'up' | 'down';

interface Item {
  name: string;
  description: string;
  takeable?: boolean;
  treasure?: boolean;
  points?: number;
  light?: boolean;
  weapon?: boolean;
  container?: boolean;
  containedItems?: string[];
  openable?: boolean;
  opened?: boolean;
}

const DIR_ALIASES: Record<string, Direction> = {
  n: 'north', s: 'south', e: 'east', w: 'west', u: 'up', d: 'down',
  north: 'north', south: 'south', east: 'east', west: 'west', up: 'up', down: 'down',
};

function createRooms(): Record<string, Room> {
  return {
    'west-of-house': {
      name: 'West of House',
      description: 'You are standing in an open field west of a white house, with a boarded front door. There is a small mailbox here.',
      exits: { north: 'north-of-house', south: 'south-of-house', west: 'forest-1' },
      items: ['mailbox'],
    },
    'north-of-house': {
      name: 'North of House',
      description: 'You are facing the north side of a white house. There is no door here, and all the windows are boarded up.',
      exits: { south: 'west-of-house', east: 'behind-house', west: 'forest-path' },
    },
    'behind-house': {
      name: 'Behind House',
      description: 'You are behind the white house. A path leads into the forest to the east. In one corner of the house there is a small window which is slightly ajar.',
      exits: { north: 'north-of-house', south: 'south-of-house', east: 'clearing', west: 'kitchen' },
    },
    'south-of-house': {
      name: 'South of House',
      description: 'You are facing the south side of a white house. There is no door here, and all the windows are boarded.',
      exits: { north: 'west-of-house', east: 'behind-house', west: 'forest-1' },
    },
    'kitchen': {
      name: 'Kitchen',
      description: 'You are in the kitchen of the white house. A table seems to have been used recently for the preparation of food. A passage leads to the west and a dark staircase can be seen leading upward. To the east is a small window which is open.',
      exits: { west: 'living-room', up: 'attic', east: 'behind-house' },
      items: ['brass-lantern', 'sack-of-food'],
    },
    'living-room': {
      name: 'Living Room',
      description: 'You are in the living room. There is a doorway to the east, a wooden door with strange gothic lettering to the west, which appears to be nailed shut, and a large oriental rug in the center of the room. There is a trophy case here. Above the trophy case hangs an elvish sword of great antiquity.',
      exits: { east: 'kitchen', down: 'cellar' },
      items: ['trophy-case', 'elvish-sword'],
    },
    'attic': {
      name: 'Attic',
      description: 'This is the attic. The only exit is a stairway leading down. A large coil of rope is lying in the corner. There is a nasty-looking knife here.',
      exits: { down: 'kitchen' },
      items: ['rope', 'nasty-knife'],
    },
    'cellar': {
      name: 'Cellar',
      description: 'You are in a dark and damp cellar with a narrow passageway leading north, and a crawlway to the south. To the west is the bottom of a steep metal ramp which is unclimbable.',
      exits: { north: 'troll-room', up: 'living-room' },
      dark: true,
    },
    'troll-room': {
      name: 'Troll Room',
      description: 'This is a small room with passages to the east and south and a forbidding hole leading west. Bloodstains and deep scratches (perhaps made by strokes of an axe) mar the walls.',
      exits: { south: 'cellar', east: 'east-west-passage', west: 'maze-1' },
      dark: true,
      blocked: { dir: 'east', by: 'troll', message: 'A nasty troll, brandishing a bloody axe, blocks your way!' },
    },
    'east-west-passage': {
      name: 'East-West Passage',
      description: 'This is a narrow east-west passageway. There is a narrow stairway leading up at the east end.',
      exits: { west: 'troll-room', east: 'round-room', up: 'dome-room' },
      dark: true,
    },
    'round-room': {
      name: 'Round Room',
      description: 'This is a circular stone room with passages in all directions. Several have been blocked by cave-ins.',
      exits: { west: 'east-west-passage', east: 'loud-room', south: 'narrow-passage' },
      dark: true,
    },
    'loud-room': {
      name: 'Loud Room',
      description: 'This is a large room with a ceiling which cannot be detected from the ground. There is a narrow passage from east to west and a stone stairway leading upward. The room is deafeningly loud with an undefined rushing sound.',
      exits: { west: 'round-room', up: 'dome-room' },
      dark: true,
      items: ['platinum-bar'],
    },
    'dome-room': {
      name: 'Dome Room',
      description: 'You are at the top of the Great Dome, which forms the ceiling of the Large Room far below. Attached to the very top of the dome is a small ivory torch, burning brightly.',
      exits: { down: 'east-west-passage' },
      dark: true,
      items: ['ivory-torch'],
    },
    'narrow-passage': {
      name: 'Narrow Passage',
      description: 'This is a narrow passage. The walls are very close together, barely allowing you to pass.',
      exits: { north: 'round-room', south: 'treasure-room' },
      dark: true,
    },
    'treasure-room': {
      name: 'Treasure Room',
      description: 'This is a large room full of all sorts of debris. A number of old crates and chests are here, some of which have been opened. Light enters the room from the east.',
      exits: { north: 'narrow-passage', east: 'temple' },
      dark: true,
      items: ['jeweled-egg', 'gold-coffin'],
    },
    'temple': {
      name: 'Temple',
      description: 'This is the west end of a large temple. On the south wall is an ancient inscription in a language which you cannot read. Flickering torchlight from the east partially illuminates the room.',
      exits: { west: 'treasure-room', east: 'egyptian-room', south: 'altar-room' },
      dark: true,
    },
    'egyptian-room': {
      name: 'Egyptian Room',
      description: 'This looks like an Egyptian tomb. There is an ascending staircase to the west. The walls are covered with hieroglyphics. A beautiful jewel-encrusted sceptre is here.',
      exits: { west: 'temple' },
      dark: true,
      items: ['sceptre'],
    },
    'altar-room': {
      name: 'Altar Room',
      description: 'This is a room with a large stone altar in the center. A beautiful chalice, apparently of solid gold, sits atop the altar. An exit leads north.',
      exits: { north: 'temple' },
      dark: true,
      items: ['chalice'],
    },
    'forest-1': {
      name: 'Forest',
      description: 'This is a dimly lit forest, with large trees all around. A narrow path leads east toward a clearing.',
      exits: { east: 'west-of-house', north: 'forest-path', south: 'forest-2' },
    },
    'forest-2': {
      name: 'Forest',
      description: 'This is a forest with tall trees blocking most of the sky. A path winds to the north.',
      exits: { north: 'forest-1', east: 'south-of-house' },
      items: ['diamond'],
    },
    'forest-path': {
      name: 'Forest Path',
      description: 'This is a path winding through a dimly lit forest. The path heads north-south here. A small clearing appears to the east.',
      exits: { south: 'forest-1', east: 'north-of-house', north: 'clearing' },
    },
    'clearing': {
      name: 'Clearing',
      description: 'You are in a small clearing in a well-marked forest path. A pile of leaves covers the ground. You notice something glinting among the leaves.',
      exits: { west: 'forest-path', south: 'behind-house' },
      items: ['jade-figurine'],
    },
    'maze-1': {
      name: 'Maze',
      description: 'You are in a maze of twisty little passages, all alike. Exits lead in every direction but most loop back here.',
      exits: { east: 'troll-room', north: 'maze-1', south: 'maze-1', west: 'maze-1' },
      dark: true,
      items: ['trident'],
    },
  };
}

function createItems(): Record<string, Item> {
  return {
    'mailbox': { name: 'small mailbox', description: 'A small mailbox with a flag.', container: true, openable: true, opened: false, containedItems: ['leaflet'] },
    'leaflet': { name: 'leaflet', description: 'WELCOME TO ZORK!\n\nZORK is a game of adventure, danger, and low cunning. In it you will explore some of the most amazing territory ever seen by mortals.', takeable: true },
    'brass-lantern': { name: 'brass lantern', description: 'A battery-powered brass lantern. It is currently off.', takeable: true, light: false },
    'sack-of-food': { name: 'sack of food', description: 'A brown sack, smelling of hot peppers.', takeable: true },
    'trophy-case': { name: 'trophy case', description: 'A large crystal trophy case with shelves for displaying treasures.', container: true, opened: true, containedItems: [] },
    'elvish-sword': { name: 'elvish sword', description: 'An elvish sword of great antiquity, its blade glowing faintly blue.', takeable: true, weapon: true },
    'rope': { name: 'rope', description: 'A large coil of sturdy hemp rope.', takeable: true },
    'nasty-knife': { name: 'nasty knife', description: 'A nasty-looking knife.', takeable: true, weapon: true },
    'jeweled-egg': { name: 'jeweled egg', description: 'A beautiful jeweled egg, intricately decorated.', takeable: true, treasure: true, points: 5 },
    'gold-coffin': { name: 'gold coffin', description: 'A sarcophagus covered in gold leaf.', takeable: true, treasure: true, points: 10 },
    'sceptre': { name: 'sceptre', description: 'A jewel-encrusted sceptre, obviously belonging to royalty.', takeable: true, treasure: true, points: 6 },
    'diamond': { name: 'diamond', description: 'A huge diamond, brilliantly cut and sparkling.', takeable: true, treasure: true, points: 10 },
    'jade-figurine': { name: 'jade figurine', description: 'A delicate jade figurine of a dragon.', takeable: true, treasure: true, points: 5 },
    'chalice': { name: 'chalice', description: 'A beautiful golden chalice, studded with jewels.', takeable: true, treasure: true, points: 10 },
    'platinum-bar': { name: 'platinum bar', description: 'A heavy bar of pure platinum.', takeable: true, treasure: true, points: 10 },
    'trident': { name: 'jewel-encrusted trident', description: 'A trident encrusted with rare jewels.', takeable: true, treasure: true, points: 4 },
    'ivory-torch': { name: 'ivory torch', description: 'A small ivory torch, burning brightly with a magical flame that never dies.', takeable: true, light: true, treasure: true, points: 5 },
  };
}

const WIN_SCORE = 65; // All treasures in trophy case
const MAX_TURNS = 150;

// ─── Player Game State ──────────────────────────────────

interface PlayerState {
  room: string;
  inventory: string[];
  score: number;
  turns: number;
  alive: boolean;
  lanternOn: boolean;
  trollAlive: boolean;
  lastOutput: string;
  rooms: Record<string, Room>;
  items: Record<string, Item>;
}

function createPlayerState(): PlayerState {
  return {
    room: 'west-of-house',
    inventory: [],
    score: 0,
    turns: 0,
    alive: true,
    lanternOn: false,
    trollAlive: true,
    lastOutput: '',
    rooms: createRooms(),
    items: createItems(),
  };
}

// ─── Engine ─────────────────────────────────────────────

export class ZorkEngine {
  private white: PlayerState;
  private black: PlayerState;
  private currentTurn: ZorkColor = 'w';
  private status: ZorkStatus = 'active';
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

  turn(): ZorkColor { return this.currentTurn; }

  boardState(): string {
    const ws = this.white;
    const bs = this.black;
    return [
      `turn=${this.currentTurn}`,
      `moves=${this.totalMoves}`,
      `w_score=${ws.score}`,
      `b_score=${bs.score}`,
      `w_room=${ws.room}`,
      `b_room=${bs.room}`,
      `w_alive=${ws.alive}`,
      `b_alive=${bs.alive}`,
      `w_output=${encodeURIComponent(ws.lastOutput)}`,
      `b_output=${encodeURIComponent(bs.lastOutput)}`,
    ].join('|');
  }

  boardForPrompt(side: ZorkColor): string {
    const p = side === 'w' ? this.white : this.black;
    const label = side === 'w' ? 'Adventurer 1' : 'Adventurer 2';
    const opp = side === 'w' ? this.black : this.white;

    const lines = [
      `=== ZORK I — ${label} ===`,
      `Score: ${p.score}/${WIN_SCORE} | Turns: ${p.turns} | Opponent score: ${opp.score}`,
      '',
      p.lastOutput,
      '',
      `Inventory: ${p.inventory.length > 0 ? p.inventory.map((id) => p.items[id]?.name || id).join(', ') : 'empty'}`,
    ];

    return lines.join('\n');
  }

  legalMoves(): string[] {
    // Free-text commands — return hints of valid commands
    return ['LOOK', 'INVENTORY', 'NORTH', 'SOUTH', 'EAST', 'WEST', 'UP', 'DOWN', 'TAKE', 'DROP', 'OPEN', 'EXAMINE', 'PUT', 'ATTACK', 'LIGHT', 'EXTINGUISH'];
  }

  makeMove(notation: string): { san: string; captured?: string } | null {
    if (this.status !== 'active') return null;

    const p = this.currentTurn === 'w' ? this.white : this.black;
    if (!p.alive) {
      this.advanceTurn();
      return { san: `[dead — skipped]` };
    }

    const cmd = notation.trim();
    if (!cmd) return null;

    const output = this.executeCommand(p, cmd);
    p.lastOutput = output;
    p.turns++;
    this.totalMoves++;

    const san = `${cmd} → ${output.split('\n')[0].slice(0, 60)}`;

    // Check win/end conditions
    this.checkEndConditions();
    if (this.status === 'active') {
      this.advanceTurn();
    }

    return { san };
  }

  isGameOver(): boolean { return this.status !== 'active'; }
  gameStatus(): ZorkStatus { return this.status; }

  // ─── Command Execution ─────────────────────────────────

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
      case 'U': case 'UP': return this.doGo(p, 'up');
      case 'D': case 'DOWN': return this.doGo(p, 'down');
      case 'GO': {
        const dir = DIR_ALIASES[rest.toLowerCase()];
        return dir ? this.doGo(p, dir) : 'I don\'t understand that direction.';
      }
      case 'TAKE': case 'GET': case 'PICK': return this.doTake(p, rest);
      case 'DROP': return this.doDrop(p, rest);
      case 'OPEN': return this.doOpen(p, rest);
      case 'EXAMINE': case 'X': case 'READ': return this.doExamine(p, rest);
      case 'PUT': case 'PLACE': return this.doPut(p, rest);
      case 'ATTACK': case 'KILL': case 'FIGHT': return this.doAttack(p, rest);
      case 'LIGHT': case 'TURN': return this.doLight(p, rest);
      case 'EXTINGUISH': return this.doExtinguish(p);
      case 'SCORE': return `Your score is ${p.score} out of a possible ${WIN_SCORE}, in ${p.turns} turns.`;
      case 'WAIT': case 'Z': return 'Time passes.';
      default: return `I don't understand "${raw}". Try: LOOK, GO direction, TAKE item, OPEN item, EXAMINE item, ATTACK enemy, INVENTORY.`;
    }
  }

  private describe(p: PlayerState): string {
    const room = p.rooms[p.room];
    if (!room) return 'You are somewhere undefined.';

    if (room.dark && !this.hasLight(p)) {
      return `${room.name}\nIt is pitch black. You are likely to be eaten by a grue.\n(Light a lantern or go back!)`;
    }

    const lines = [room.name, room.description];

    // Show items on the ground
    const groundItems = (room.items || []).filter((id) => {
      const item = p.items[id];
      return item && item.takeable;
    });
    if (groundItems.length > 0) {
      lines.push(`You can see: ${groundItems.map((id) => p.items[id].name).join(', ')}.`);
    }

    // Show exits
    const exits = Object.keys(room.exits);
    if (exits.length > 0) lines.push(`Exits: ${exits.join(', ')}`);

    // Show blocker
    if (room.blocked && p.trollAlive) {
      lines.push(room.blocked.message);
    }

    return lines.join('\n');
  }

  private doInventory(p: PlayerState): string {
    if (p.inventory.length === 0) return 'You are empty-handed.';
    const items = p.inventory.map((id) => {
      const item = p.items[id];
      let name = item?.name || id;
      if (id === 'brass-lantern') name += p.lanternOn ? ' (providing light)' : ' (off)';
      return name;
    });
    return `You are carrying:\n${items.map((n) => `  ${n}`).join('\n')}`;
  }

  private doGo(p: PlayerState, dir: Direction): string {
    const room = p.rooms[p.room];
    if (!room) return 'You can\'t go that way.';

    // Check blocker
    if (room.blocked && room.blocked.dir === dir && p.trollAlive) {
      return room.blocked.message;
    }

    const dest = room.exits[dir];
    if (!dest) return 'You can\'t go that way.';

    // Dark death check
    const destRoom = p.rooms[dest];
    if (destRoom?.dark && !this.hasLight(p)) {
      // Moving into darkness without light — grue attack after 1 turn in dark
      p.room = dest;
      return `${destRoom.name}\nIt is pitch black. You are likely to be eaten by a grue. Find light quickly!`;
    }

    p.room = dest;
    return this.describe(p);
  }

  private doTake(p: PlayerState, target: string): string {
    const itemId = this.findItem(p, target, 'room');
    if (!itemId) {
      // Check containers in room
      const containerItem = this.findInContainer(p, target);
      if (containerItem) {
        p.inventory.push(containerItem);
        return `Taken: ${p.items[containerItem]?.name || containerItem}.`;
      }
      return 'You can\'t see that here.';
    }
    const item = p.items[itemId];
    if (!item?.takeable) return `You can't take the ${item?.name || target}.`;

    // Remove from room
    const room = p.rooms[p.room];
    if (room.items) room.items = room.items.filter((id) => id !== itemId);
    p.inventory.push(itemId);
    return `Taken: ${item.name}.`;
  }

  private doDrop(p: PlayerState, target: string): string {
    const itemId = this.findItem(p, target, 'inventory');
    if (!itemId) return 'You don\'t have that.';
    const item = p.items[itemId];
    p.inventory = p.inventory.filter((id) => id !== itemId);
    const room = p.rooms[p.room];
    if (!room.items) room.items = [];
    room.items.push(itemId);
    return `Dropped: ${item?.name || itemId}.`;
  }

  private doOpen(p: PlayerState, target: string): string {
    const itemId = this.findItem(p, target, 'room') || this.findItem(p, target, 'inventory');
    if (!itemId) return 'You can\'t see that here.';
    const item = p.items[itemId];
    if (!item?.openable) return `You can't open the ${item?.name || target}.`;
    if (item.opened) return 'It\'s already open.';
    item.opened = true;
    if (item.containedItems && item.containedItems.length > 0) {
      const contents = item.containedItems.map((id) => p.items[id]?.name || id).join(', ');
      // Move items to room
      const room = p.rooms[p.room];
      if (!room.items) room.items = [];
      for (const id of item.containedItems) room.items.push(id);
      item.containedItems = [];
      return `Opening the ${item.name} reveals: ${contents}.`;
    }
    return `You open the ${item.name}. It's empty.`;
  }

  private doExamine(p: PlayerState, target: string): string {
    const itemId = this.findItem(p, target, 'any');
    if (!itemId) return 'You can\'t see that here.';
    const item = p.items[itemId];
    let desc = item?.description || 'Nothing special.';
    if (item?.container && item.opened && item.containedItems) {
      if (item.containedItems.length > 0) {
        desc += `\nContains: ${item.containedItems.map((id) => p.items[id]?.name || id).join(', ')}.`;
      } else {
        desc += '\nIt is empty.';
      }
    }
    return desc;
  }

  private doPut(p: PlayerState, rest: string): string {
    // PUT X IN Y
    const match = rest.match(/(.+?)\s+IN\s+(.+)/i);
    if (!match) return 'Put what in what? (PUT <item> IN <container>)';

    const itemId = this.findItem(p, match[1].trim(), 'inventory');
    if (!itemId) return 'You don\'t have that.';

    const containerId = this.findItem(p, match[2].trim(), 'room') || this.findItem(p, match[2].trim(), 'inventory');
    if (!containerId) return 'You can\'t see that container here.';

    const container = p.items[containerId];
    if (!container?.container) return `The ${container?.name || match[2]} isn't a container.`;
    if (!container.opened) return `The ${container.name} is closed.`;

    const item = p.items[itemId];
    p.inventory = p.inventory.filter((id) => id !== itemId);
    if (!container.containedItems) container.containedItems = [];
    container.containedItems.push(itemId);

    // Score treasures placed in trophy case
    if (containerId === 'trophy-case' && item?.treasure && item.points) {
      p.score += item.points;
      return `You place the ${item.name} in the trophy case. (Score: +${item.points}, total: ${p.score}/${WIN_SCORE})`;
    }

    return `You put the ${item?.name || itemId} in the ${container.name}.`;
  }

  private doAttack(p: PlayerState, rest: string): string {
    if (!rest.includes('TROLL') && p.room !== 'troll-room') {
      return 'There\'s nothing here to attack.';
    }
    if (p.room !== 'troll-room' || !p.trollAlive) {
      return 'There\'s nothing here to attack.';
    }

    const hasWeapon = p.inventory.some((id) => p.items[id]?.weapon);
    if (!hasWeapon) {
      return 'Attacking the troll bare-handed is suicidal. You need a weapon!';
    }

    // Combat: succeed with weapon
    p.trollAlive = false;
    const room = p.rooms['troll-room'];
    if (room.blocked) delete room.blocked;
    return 'Your sword connects! The troll staggers back, then crumbles into dust. The passageway to the east is now clear.';
  }

  private doLight(p: PlayerState, rest: string): string {
    if (!p.inventory.includes('brass-lantern') && !rest.includes('LANTERN') && !rest.includes('LAMP')) {
      // Check for ivory torch
      if (p.inventory.includes('ivory-torch')) return 'The ivory torch already burns with a magical light.';
      return 'You have no light source to turn on.';
    }
    if (!p.inventory.includes('brass-lantern')) return 'You don\'t have the lantern.';
    if (p.lanternOn) return 'The lantern is already on.';
    p.lanternOn = true;
    p.items['brass-lantern'].light = true;
    // Redescribe if in dark room
    const room = p.rooms[p.room];
    if (room?.dark) {
      return `The brass lantern is now on.\n\n${this.describe(p)}`;
    }
    return 'The brass lantern is now on.';
  }

  private doExtinguish(p: PlayerState): string {
    if (!p.inventory.includes('brass-lantern')) return 'You don\'t have the lantern.';
    if (!p.lanternOn) return 'The lantern is already off.';
    p.lanternOn = false;
    p.items['brass-lantern'].light = false;
    return 'The brass lantern is now off.';
  }

  // ─── Helpers ───────────────────────────────────────────

  private hasLight(p: PlayerState): boolean {
    return p.inventory.some((id) => p.items[id]?.light === true);
  }

  private findItem(p: PlayerState, target: string, where: 'room' | 'inventory' | 'any'): string | null {
    const normalized = target.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    if (!normalized) return null;

    const check = (id: string): boolean => {
      const item = p.items[id];
      if (!item) return false;
      const name = item.name.toLowerCase();
      return name.includes(normalized) || id.includes(normalized.replace(/\s+/g, '-'));
    };

    if (where === 'inventory' || where === 'any') {
      const found = p.inventory.find(check);
      if (found) return found;
    }
    if (where === 'room' || where === 'any') {
      const room = p.rooms[p.room];
      const found = (room?.items || []).find(check);
      if (found) return found;
    }
    return null;
  }

  private findInContainer(p: PlayerState, target: string): string | null {
    const normalized = target.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    const room = p.rooms[p.room];
    for (const cid of (room?.items || [])) {
      const container = p.items[cid];
      if (!container?.container || !container.opened || !container.containedItems) continue;
      const found = container.containedItems.find((id) => {
        const item = p.items[id];
        return item && (item.name.toLowerCase().includes(normalized) || id.includes(normalized.replace(/\s+/g, '-')));
      });
      if (found) {
        container.containedItems = container.containedItems.filter((id) => id !== found);
        return found;
      }
    }
    return null;
  }

  private advanceTurn(): void {
    this.currentTurn = this.currentTurn === 'w' ? 'b' : 'w';
  }

  private checkEndConditions(): void {
    if (this.white.score >= WIN_SCORE) {
      this.status = 'white_wins';
    } else if (this.black.score >= WIN_SCORE) {
      this.status = 'black_wins';
    } else if (this.totalMoves >= MAX_TURNS * 2) {
      if (this.white.score > this.black.score) this.status = 'white_wins';
      else if (this.black.score > this.white.score) this.status = 'black_wins';
      else this.status = 'draw';
    }
  }
}
