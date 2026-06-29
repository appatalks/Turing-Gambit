interface Props {
  boardState: string;
  interactive?: boolean;
  onHumanMove?: (notation: string) => void;
  legalMoves?: string[];
}

export function MysticQuestBoard({
  boardState,
  interactive = false,
  onHumanMove,
  legalMoves = [],
}: Props) {
  // Format: currentRoom|whiteHP|blackHP|whiteTreasure|blackTreasure|moveCount|dungeonSize|turn|rooms
  const parts = boardState.split('|');
  const currentRoom = parseInt(parts[0] || '0');
  const whiteHP = parseInt(parts[1] || '20');
  const blackHP = parseInt(parts[2] || '20');
  const whiteTreasure = parseInt(parts[3] || '0');
  const blackTreasure = parseInt(parts[4] || '0');
  const moveCount = parseInt(parts[5] || '0');
  const dungeonSize = parseInt(parts[6] || '10');
  const turn = parts[7] || 'w';
  const roomsStr = parts[8] || '';

  const rooms = roomsStr.split(',').map((r) => {
    const [type, cleared] = r.split(':');
    return { type, cleared: cleared === '1' };
  });

  function play(action: string) {
    if (!interactive || !onHumanMove) return;
    if (!legalMoves.includes(action)) return;
    onHumanMove(action);
  }

  const role = turn === 'w' ? 'Warrior' : 'Mage';
  const currentRoomData = rooms[currentRoom];

  const roomIcons: Record<string, string> = {
    empty: '🏚️', monster: '👹', treasure: '💰', trap: '⚠️', exit: '🚪',
  };

  return (
    <div className="pd-wrap">
      <div className="pd-header">⚔️ Mystic Quest — Room {currentRoom + 1}/{dungeonSize}</div>

      <div className="pd-scores">
        <span className="pd-sa">🗡️ Warrior HP: {whiteHP} | 💎 {whiteTreasure}</span>
        <span className="pd-coop">Move {moveCount}</span>
        <span className="pd-sb">🧙 Mage HP: {blackHP} | 💎 {blackTreasure}</span>
      </div>

      {/* Dungeon map */}
      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', padding: '12px 0', flexWrap: 'wrap' }}>
        {rooms.map((room, i) => (
          <div
            key={i}
            style={{
              width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 4,
              fontSize: 16,
              border: i === currentRoom ? '2px solid #f0c040' : '1px solid #333',
              background: room.cleared ? '#1a2a1a' : i === currentRoom ? '#2a2a3a' : '#1a1a2a',
              opacity: room.cleared && i !== currentRoom ? 0.5 : 1,
            }}
            title={`Room ${i + 1}: ${room.type}${room.cleared ? ' (cleared)' : ''}`}
          >
            {roomIcons[room.type] || '❓'}
          </div>
        ))}
      </div>

      <div className="pd-explain">
        {currentRoomData && (
          <>
            {roomIcons[currentRoomData.type] || '❓'}{' '}
            {currentRoomData.type === 'monster' && !currentRoomData.cleared && 'A monster blocks your path!'}
            {currentRoomData.type === 'treasure' && !currentRoomData.cleared && 'Treasure glitters in the darkness!'}
            {currentRoomData.type === 'trap' && !currentRoomData.cleared && 'A trap lies ahead!'}
            {currentRoomData.type === 'exit' && !currentRoomData.cleared && 'The exit beckons!'}
            {currentRoomData.type === 'empty' && 'An empty room.'}
            {currentRoomData.cleared && currentRoomData.type !== 'empty' && ' (Cleared)'}
            <br />
            <b>{role}</b>'s turn
          </>
        )}
      </div>

      {interactive && (
        <div className="pd-buttons">
          {legalMoves.map((move) => (
            <button
              key={move}
              className={`pd-btn ${move === 'ATTACK' || move === 'CAST' ? 'pd-btn-defect' : 'pd-btn-coop'}`}
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
