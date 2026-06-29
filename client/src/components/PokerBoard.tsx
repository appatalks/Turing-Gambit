interface Props {
  boardState: string;
  interactive?: boolean;
  onHumanMove?: (notation: string) => void;
  legalMoves?: string[];
}

const SUIT_INFO: Record<string, { symbol: string; color: string }> = {
  h: { symbol: '♥', color: '#e74c3c' },
  d: { symbol: '♦', color: '#e74c3c' },
  c: { symbol: '♣', color: '#1a1a2e' },
  s: { symbol: '♠', color: '#1a1a2e' },
};

function displayRank(rank: string): string {
  if (rank === '11') return 'J';
  if (rank === '12') return 'Q';
  if (rank === '13') return 'K';
  if (rank === '14') return 'A';
  return rank;
}

function parseCard(token: string): { rank: string; suit: string } | null {
  const match = token.match(/^(\d+|[JQKA])([hdcs])$/i);
  if (!match) return null;
  let rank = match[1].toUpperCase();
  if (rank === 'J') rank = '11';
  if (rank === 'Q') rank = '12';
  if (rank === 'K') rank = '13';
  if (rank === 'A') rank = '14';
  return { rank, suit: match[2].toLowerCase() };
}

function CardFace({ token, faceDown }: { token?: string; faceDown?: boolean }) {
  if (faceDown || !token) {
    return (
      <div className="pk-card pk-card-back">
        <div className="pk-card-back-pattern">
          <div className="pk-card-back-inner">♠♥♦♣</div>
        </div>
      </div>
    );
  }

  const card = parseCard(token);
  if (!card) return <div className="pk-card pk-card-back"><div className="pk-card-back-pattern">?</div></div>;

  const info = SUIT_INFO[card.suit] || SUIT_INFO['s'];
  const rank = displayRank(card.rank);

  return (
    <div className="pk-card" style={{ '--card-color': info.color } as React.CSSProperties}>
      <div className="pk-card-corner pk-card-tl">
        <span className="pk-card-rank">{rank}</span>
        <span className="pk-card-suit">{info.symbol}</span>
      </div>
      <div className="pk-card-center">
        <span className="pk-card-big-suit">{info.symbol}</span>
      </div>
      <div className="pk-card-corner pk-card-br">
        <span className="pk-card-rank">{rank}</span>
        <span className="pk-card-suit">{info.symbol}</span>
      </div>
    </div>
  );
}

function ChipStack({ amount, label }: { amount: string; label?: string }) {
  const n = parseInt(amount) || 0;
  return (
    <div className="pk-chips">
      <div className="pk-chip-icon">
        <div className="pk-chip" />
      </div>
      <span className="pk-chip-amount">{n.toLocaleString()}</span>
      {label && <span className="pk-chip-label">{label}</span>}
    </div>
  );
}

const ACTION_INFO: Record<string, { label: string; icon: string; cls: string }> = {
  FOLD: { label: 'Fold', icon: '🏳️', cls: 'pk-btn-fold' },
  CHECK: { label: 'Check', icon: '✓', cls: 'pk-btn-check' },
  CALL: { label: 'Call', icon: '📞', cls: 'pk-btn-call' },
  RAISE_SMALL: { label: 'Raise', icon: '⬆', cls: 'pk-btn-raise' },
  RAISE_BIG: { label: 'Big Raise', icon: '⬆⬆', cls: 'pk-btn-raise-big' },
  ALL_IN: { label: 'All In', icon: '💥', cls: 'pk-btn-allin' },
};

const STREET_LABELS: Record<string, string> = {
  preflop: 'Pre-Flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
};

export function PokerBoard({
  boardState,
  interactive = false,
  onHumanMove,
  legalMoves = [],
}: Props) {
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

  // Pad community to 5 slots for visual layout
  const communitySlots: (string | null)[] = [];
  for (let i = 0; i < 5; i++) communitySlots.push(community[i] || null);

  function play(action: string) {
    if (!interactive || !onHumanMove) return;
    if (!legalMoves.includes(action)) return;
    onHumanMove(action);
  }

  const potNum = parseInt(pot) || 0;

  return (
    <div className="pk-table">
      {/* Header */}
      <div className="pk-header">
        <span className="pk-hand-num">Hand {hand}/20</span>
        <span className="pk-street-badge">{STREET_LABELS[street] || street}</span>
      </div>

      {/* Felt area */}
      <div className="pk-felt">
        {/* Black player (top) */}
        <div className={`pk-seat pk-seat-top ${turn === 'b' ? 'pk-seat-active' : ''}`}>
          <div className="pk-seat-info">
            <span className="pk-seat-name">Player 2</span>
            <ChipStack amount={bChips} />
          </div>
          <div className="pk-hand">
            {bHole.length > 0
              ? bHole.map((c, i) => <CardFace key={i} token={c} />)
              : <>
                  <CardFace faceDown />
                  <CardFace faceDown />
                </>
            }
          </div>
          {parseInt(bBet) > 0 && (
            <div className="pk-bet-area">
              <ChipStack amount={bBet} label="bet" />
            </div>
          )}
        </div>

        {/* Community cards (center) */}
        <div className="pk-center">
          <div className="pk-pot-display">
            <div className="pk-pot-chips" />
            <span className="pk-pot-amount">Pot: {potNum.toLocaleString()}</span>
          </div>
          <div className="pk-community">
            {communitySlots.map((c, i) => (
              <div key={i} className={`pk-community-slot ${c ? 'pk-community-dealt' : ''}`}>
                {c ? <CardFace token={c} /> : <div className="pk-card pk-card-placeholder" />}
              </div>
            ))}
          </div>
        </div>

        {/* White player (bottom) */}
        <div className={`pk-seat pk-seat-bottom ${turn === 'w' ? 'pk-seat-active' : ''}`}>
          {parseInt(wBet) > 0 && (
            <div className="pk-bet-area">
              <ChipStack amount={wBet} label="bet" />
            </div>
          )}
          <div className="pk-hand">
            {wHole.length > 0
              ? wHole.map((c, i) => <CardFace key={i} token={c} />)
              : <>
                  <CardFace faceDown />
                  <CardFace faceDown />
                </>
            }
          </div>
          <div className="pk-seat-info">
            <span className="pk-seat-name">Player 1</span>
            <ChipStack amount={wChips} />
          </div>
        </div>
      </div>

      {/* Action bar */}
      {interactive && legalMoves.length > 0 && (
        <div className="pk-actions">
          {legalMoves.map((move) => {
            const info = ACTION_INFO[move] || { label: move, icon: '▶', cls: '' };
            return (
              <button
                key={move}
                className={`pk-action-btn ${info.cls}`}
                onClick={() => play(move)}
              >
                <span className="pk-action-icon">{info.icon}</span>
                <span className="pk-action-label">{info.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
