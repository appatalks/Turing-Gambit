interface Props {
  boardState: string;
  interactive?: boolean;
  onHumanMove?: (notation: string) => void;
  legalMoves?: string[];
}

const SUIT_SYMBOLS: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' };
const SUIT_COLORS: Record<string, string> = { h: '#e74c3c', d: '#e74c3c', c: '#2c3e50', s: '#2c3e50' };

function parseCard(token: string): { rank: string; suit: string } | null {
  const match = token.match(/^(\d+|[JQKA])([hdcs])$/i);
  if (!match) return null;
  return { rank: match[1], suit: match[2].toLowerCase() };
}

function renderCard(token: string, index: number) {
  const card = parseCard(token);
  if (!card) return <span key={index} className="poker-card poker-card-back">?</span>;
  const symbol = SUIT_SYMBOLS[card.suit] || card.suit;
  const color = SUIT_COLORS[card.suit] || '#2c3e50';
  return (
    <span key={index} className="poker-card" style={{ color }}>
      {card.rank}{symbol}
    </span>
  );
}

const ACTION_LABELS: Record<string, { label: string; cls: string }> = {
  FOLD: { label: 'Fold', cls: 'poker-btn-fold' },
  CHECK: { label: 'Check', cls: 'poker-btn-check' },
  CALL: { label: 'Call', cls: 'poker-btn-call' },
  RAISE_SMALL: { label: 'Raise Small', cls: 'poker-btn-raise' },
  RAISE_BIG: { label: 'Raise Big', cls: 'poker-btn-raise' },
  ALL_IN: { label: 'All In', cls: 'poker-btn-allin' },
};

export function PokerBoard({
  boardState,
  interactive = false,
  onHumanMove,
  legalMoves = [],
}: Props) {
  // Parse: hand:1 street:preflop pot:30 w_chips:990 b_chips:980 w_bet:10 b_bet:20 community:- w_hole:Ah,Kd b_hole:9s,3c turn:w
  const fields: Record<string, string> = {};
  for (const token of boardState.split(' ')) {
    const sep = token.indexOf(':');
    if (sep > 0) fields[token.slice(0, sep)] = token.slice(sep + 1);
  }

  const hand = fields['hand'] || '1';
  const street = fields['street'] || 'preflop';
  const pot = fields['pot'] || '0';
  const wChips = fields['w_chips'] || '0';
  const bChips = fields['b_chips'] || '0';
  const wBet = fields['w_bet'] || '0';
  const bBet = fields['b_bet'] || '0';
  const communityStr = fields['community'] || '-';
  const wHoleStr = fields['w_hole'] || '-';
  const bHoleStr = fields['b_hole'] || '-';
  const turn = fields['turn'] || 'w';

  const community = communityStr === '-' ? [] : communityStr.split(',');
  const wHole = wHoleStr === '-' ? [] : wHoleStr.split(',');
  const bHole = bHoleStr === '-' ? [] : bHoleStr.split(',');

  function play(action: string) {
    if (!interactive || !onHumanMove) return;
    if (!legalMoves.includes(action)) return;
    onHumanMove(action);
  }

  return (
    <div className="poker-wrap">
      <div className="poker-info">
        <span className="poker-hand">Hand {hand}</span>
        <span className="poker-street">{street.toUpperCase()}</span>
      </div>

      {/* Black (top) */}
      <div className={`poker-player ${turn === 'b' ? 'poker-active' : ''}`}>
        <div className="poker-label">Black</div>
        <div className="poker-chips">💰 {bChips} <span className="poker-bet">(bet {bBet})</span></div>
        <div className="poker-hole">
          {bHole.length > 0 ? bHole.map(renderCard) : <span className="poker-hidden">🂠 🂠</span>}
        </div>
      </div>

      {/* Community & pot */}
      <div className="poker-community">
        <div className="poker-pot">Pot: {pot}</div>
        <div className="poker-cards">
          {community.length > 0
            ? community.map(renderCard)
            : <span className="poker-empty">No community cards yet</span>}
        </div>
      </div>

      {/* White (bottom) */}
      <div className={`poker-player ${turn === 'w' ? 'poker-active' : ''}`}>
        <div className="poker-label">White</div>
        <div className="poker-chips">💰 {wChips} <span className="poker-bet">(bet {wBet})</span></div>
        <div className="poker-hole">
          {wHole.length > 0 ? wHole.map(renderCard) : <span className="poker-hidden">🂠 🂠</span>}
        </div>
      </div>

      {/* Action buttons */}
      {interactive && legalMoves.length > 0 && (
        <div className="poker-actions">
          {legalMoves.map((move) => {
            const info = ACTION_LABELS[move] || { label: move, cls: '' };
            return (
              <button
                key={move}
                className={`poker-btn ${info.cls}`}
                onClick={() => play(move)}
              >
                {info.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
