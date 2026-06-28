interface Props {
  boardState: string; // "hist scoreW scoreB round turn"
  interactive?: boolean;
  onHumanMove?: (notation: string) => void;
  legalMoves?: string[];
}

export function PrisonersDilemmaBoard({
  boardState,
  interactive = false,
  onHumanMove,
  legalMoves = [],
}: Props) {
  const parts = boardState.split(' ');
  // hist may be empty (parts[0] === scoreW). Detect by counting tokens.
  let hist = '';
  let idx = 0;
  if (parts.length >= 5) { hist = parts[0]; idx = 1; }
  const scoreW = parts[idx] || '0';
  const scoreB = parts[idx + 1] || '0';
  const round = parts[idx + 2] || '1';

  const rounds: { w: string; b: string }[] = [];
  for (let i = 0; i + 1 < hist.length; i += 2) {
    rounds.push({ w: hist[i], b: hist[i + 1] });
  }

  const totalChoices = rounds.length * 2;
  const coops = rounds.reduce((n, r) => n + (r.w === 'C' ? 1 : 0) + (r.b === 'C' ? 1 : 0), 0);
  const coopRate = totalChoices > 0 ? Math.round((coops / totalChoices) * 100) : 0;

  function play(choice: string) {
    if (!interactive || !onHumanMove) return;
    if (!legalMoves.includes(choice)) return;
    onHumanMove(choice);
  }

  return (
    <div className="pd-wrap">
      <div className="pd-header">Round {round} / 10</div>

      <table className="pd-matrix">
        <thead>
          <tr><th></th><th>B: Cooperate</th><th>B: Defect</th></tr>
        </thead>
        <tbody>
          <tr><th>A: Cooperate</th><td className="pd-cc">3 / 3</td><td className="pd-cd">0 / 5</td></tr>
          <tr><th>A: Defect</th><td className="pd-dc">5 / 0</td><td className="pd-dd">1 / 1</td></tr>
        </tbody>
      </table>

      <div className="pd-scores">
        <span className="pd-sa">A: {scoreW}</span>
        <span className="pd-coop">Cooperation {coopRate}%</span>
        <span className="pd-sb">B: {scoreB}</span>
      </div>

      <div className="pd-history">
        {rounds.length === 0 && <div className="pd-empty">No rounds played yet</div>}
        {rounds.map((r, i) => (
          <div key={i} className="pd-round">
            <span className="pd-rn">R{i + 1}</span>
            <span className={`pd-choice ${r.w === 'C' ? 'pd-coop-c' : 'pd-defect-c'}`}>{r.w === 'C' ? 'Coop' : 'Defect'}</span>
            <span className="pd-vs">vs</span>
            <span className={`pd-choice ${r.b === 'C' ? 'pd-coop-c' : 'pd-defect-c'}`}>{r.b === 'C' ? 'Coop' : 'Defect'}</span>
          </div>
        ))}
      </div>

      {interactive && (
        <div className="pd-buttons">
          <button className="pd-btn pd-btn-coop" onClick={() => play('COOPERATE')}>Cooperate</button>
          <button className="pd-btn pd-btn-defect" onClick={() => play('DEFECT')}>Defect</button>
        </div>
      )}
    </div>
  );
}
