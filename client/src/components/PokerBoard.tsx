interface Props {
  boardState: string;
  interactive?: boolean;
  onHumanMove?: (notation: string) => void;
  legalMoves?: string[];
}

const SUIT_SYMBOLS: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' };
const SUIT_COLORS: Record<string, string> = { h: '#e74c3c', d: '#e74c3c', c: '#ecf0f1', s: '#ecf0f1' };

function renderCard(card: string): { display: string; color: string } {
  if (card === '??' || !card) return { display: '🂠', color: '#888' };
  const rank = card[0] || '?';
  const suit = card[1] || '?';
  return {
    display: `${rank}${SUIT_SYMBOLS[suit] || suit}`,
    color: SUIT_COLORS[suit] || '#fff',
  };
}

export function PokerBoard({
  boardState,
  interactive = false,
  onHumanMove,
  legalMoves = [],
}: Props) {
  // Format: wHole|bHole|community|wChips|bChips|pot|handNum|turn|round
  const parts = boardState.split('|');
  const wHoleStr = parts[0] || '??,??';
  const bHoleStr = parts[1] || '??,??';
  const commStr = parts[2] || '-';
  const wChips = parseInt(parts[3] || '1000');
  const bChips = parseInt(parts[4] || '1000');
  const pot = parseInt(parts[5] || '0');
  const handNum = parseInt(parts[6] || '1');
  const turn = parts[7] || 'w';
  const round = parts[8] || 'preflop';

  const wCards = wHoleStr.split(',');
  const bCards = bHoleStr.split(',');
  const community = commStr === '-' ? [] : commStr.split(',');

  function play(action: string) {
    if (!interactive || !onHumanMove) return;
    if (!legalMoves.includes(action)) return;
    onHumanMove(action);
  }

  const cardStyle = (color: string) => ({
    display: 'inline-block',
    padding: '6px 10px',
    margin: '0 3px',
    borderRadius: 6,
    background: '#1a1a2e',
    border: '1px solid #333',
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: 'bold',
    color,
  });

  return (
    <div className="pd-wrap">
      <div className="pd-header">🃏 Texas Hold'em — Hand {handNum}/20 ({round})</div>

      <div className="pd-scores">
        <span className="pd-sa">White: {wChips} chips</span>
        <span className="pd-coop">Pot: {pot}</span>
        <span className="pd-sb">Black: {bChips} chips</span>
      </div>

      {/* Opponent's cards (face down or revealed) */}
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ opacity: 0.6, fontSize: 12, marginBottom: 4 }}>Black's cards</div>
        {bCards.map((c, i) => {
          const r = renderCard(c);
          return <span key={i} style={cardStyle(r.color)}>{r.display}</span>;
        })}
      </div>

      {/* Community cards */}
      <div style={{ textAlign: 'center', padding: '12px 0', borderTop: '1px solid #333', borderBottom: '1px solid #333' }}>
        <div style={{ opacity: 0.6, fontSize: 12, marginBottom: 4 }}>Community</div>
        {community.length === 0 ? (
          <span style={{ opacity: 0.4, fontStyle: 'italic' }}>No cards yet</span>
        ) : (
          community.map((c, i) => {
            const r = renderCard(c);
            return <span key={i} style={cardStyle(r.color)}>{r.display}</span>;
          })
        )}
      </div>

      {/* Player's cards */}
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ opacity: 0.6, fontSize: 12, marginBottom: 4 }}>White's cards</div>
        {wCards.map((c, i) => {
          const r = renderCard(c);
          return <span key={i} style={cardStyle(r.color)}>{r.display}</span>;
        })}
      </div>

      <div className="pd-explain" style={{ textAlign: 'center' }}>
        <b>{turn === 'w' ? 'White' : 'Black'}</b>'s turn
      </div>

      {interactive && (
        <div className="pd-buttons">
          {legalMoves.map((move) => (
            <button
              key={move}
              className={`pd-btn ${move === 'FOLD' ? 'pd-btn-defect' : 'pd-btn-coop'}`}
              onClick={() => play(move)}
            >
              {move}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
