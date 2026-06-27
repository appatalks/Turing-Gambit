import { useState, useCallback, useRef } from 'react';
import { useSocket } from './hooks/useSocket';
import { MatchConfigPanel } from './components/MatchConfig';
import { ChessBoardView } from './components/ChessBoard';
import { CheckersBoardView } from './components/CheckersBoard';
import { PlayerPanel } from './components/PlayerPanel';
import { MoveLog } from './components/MoveLog';
import { ControlPanel } from './components/ControlPanel';
import { MetricsPanel } from './components/MetricsPanel';
import { SettingsModal, loadSavedKeys } from './components/SettingsModal';
import { MatchTimer } from './components/MatchTimer';
import { MusicPlayer, type MusicPlayerHandle } from './components/MusicPlayer';
import { VictorySplash } from './components/VictorySplash';
import { ThinkingTerminal } from './components/ThinkingTerminal';
import { WindowControls } from './components/WindowControls';
import type { MatchConfig } from './types';
import './App.css';

export default function App() {
  const {
    connected,
    matchState,
    thinkingText,
    error,
    startMatch,
    setKeys,
    pauseMatch,
    resumeMatch,
    stepMatch,
    submitHumanMove,
    resetMatch,
    exportMatch,
  } = useSocket();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logCollapsed, setLogCollapsed] = useState(false);
  const musicRef = useRef<MusicPlayerHandle>(null);

  const handleStart = useCallback((config: MatchConfig) => {
    setKeys(loadSavedKeys());
    startMatch(config);
  }, [setKeys, startMatch]);

  // ── Config screen ────────────────────────────────
  if (!matchState) {
    return (
      <div className="app">
        <WindowControls onSettings={() => setSettingsOpen(true)} onMusicFiles={(f) => musicRef.current?.loadFiles(f)} />
        <div className="connection-dot" data-connected={connected} title={connected ? 'Connected' : 'Disconnected'} />
        {error && <div className="error-toast">{error}</div>}
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onSave={setKeys} />
        <MusicPlayer ref={musicRef} />
        <MatchConfigPanel onStart={handleStart} />
      </div>
    );
  }

  // ── Match view ───────────────────────────────────
  const {
    fen,
    turn,
    moveHistory,
    capturedPieces,
    gameStatus,
    status,
    metrics,
    thinking,
    thinkingPlayer,
    awaitingHuman,
    lastMove,
    white,
    black,
  } = matchState;

  // Human-vs-AI helpers
  const currentPlayer = turn === 'w' ? white : black;
  const isHumanTurn =
    status !== 'completed' && currentPlayer.type === 'human' && awaitingHuman;
  // Orient board toward the human side (if exactly one side is human)
  const humanIsWhite = white.type === 'human';
  const humanIsBlack = black.type === 'human';
  const boardOrientation: 'white' | 'black' =
    humanIsBlack && !humanIsWhite ? 'black' : 'white';

  return (
    <div className="app">
      <WindowControls onSettings={() => setSettingsOpen(true)} onMusicFiles={(f) => musicRef.current?.loadFiles(f)} />
      <div className="connection-dot" data-connected={connected} title={connected ? 'Connected' : 'Disconnected'} />
      {error && <div className="error-toast">{error}</div>}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onSave={setKeys} />

      {/* Victory / game-over splash */}
      <VictorySplash state={matchState} onNewMatch={resetMatch} />

      {/* Top bar */}
      <header className="arena-header">
        <div className="arena-brand">
          <span className="brand-icon">♔</span>
          <span className="brand-title">Turing-Gambit</span>
          <span className="brand-icon">♚</span>
        </div>
        <MatchTimer state={matchState} />
        <div className="arena-header-right">
          <MusicPlayer ref={musicRef} />
        </div>
      </header>

      {/* Main layout */}
      <main className="arena-layout">
        {/* Left — White panel */}
        <aside className="arena-side">
          <PlayerPanel
            color="white"
            provider={white}
            metrics={metrics}
            captured={capturedPieces}
            isThinking={thinking && thinkingPlayer === 'w'}
            isActive={turn === 'w' && status !== 'completed'}
          />
          <ThinkingTerminal
            modelName={white.type === 'human' ? 'You' : white.model}
            text={thinkingText.w}
            isLive={thinking && thinkingPlayer === 'w'}
          />
          {status === 'completed' && <MetricsPanel state={matchState} />}
        </aside>

        {/* Center — Board */}
        <section className="arena-center">
          <div className="turn-indicator">
            <span className={`turn-dot ${turn === 'w' ? 'turn-white' : 'turn-black'}`} />
            <span>
              {status === 'completed'
                ? 'Game Over'
                : isHumanTurn
                  ? `Your move (${turn === 'w' ? 'White' : 'Black'}) — ${matchState.game === 'checkers' ? 'click a piece' : 'drag a piece'}`
                  : thinking
                    ? `${turn === 'w' ? 'White' : 'Black'} is thinking...`
                    : `${turn === 'w' ? 'White' : 'Black'} to move`}
            </span>
          </div>
          {matchState.game === 'checkers' ? (
            <CheckersBoardView
              boardState={fen}
              lastMove={lastMove ? { from: parseInt(lastMove.from), to: parseInt(lastMove.to) } : undefined}
              interactive={isHumanTurn}
              boardOrientation={boardOrientation === 'black' ? 'black' : 'white'}
              onHumanMove={submitHumanMove}
              legalMoves={matchState.legalMoves || []}
            />
          ) : (
            <ChessBoardView
              fen={fen}
              lastMove={lastMove}
              interactive={isHumanTurn}
              boardOrientation={boardOrientation}
              onHumanMove={submitHumanMove}
            />
          )}
          <ControlPanel
            status={status}
            gameStatus={gameStatus}
            fen={fen}
            onPause={pauseMatch}
            onResume={resumeMatch}
            onStep={stepMatch}
            onReset={resetMatch}
          />
        </section>

        {/* Right — Black panel */}
        <aside className="arena-side">
          <PlayerPanel
            color="black"
            provider={black}
            metrics={metrics}
            captured={capturedPieces}
            isThinking={thinking && thinkingPlayer === 'b'}
            isActive={turn === 'b' && status !== 'completed'}
          />
          <ThinkingTerminal
            modelName={black.type === 'human' ? 'You' : black.model}
            text={thinkingText.b}
            isLive={thinking && thinkingPlayer === 'b'}
          />
        </aside>
      </main>

      {/* Bottom — Move log */}
      <footer className={`arena-footer ${logCollapsed ? 'arena-footer-collapsed' : ''}`}>
        <MoveLog
          moves={moveHistory}
          collapsed={logCollapsed}
          onToggle={() => setLogCollapsed((c) => !c)}
        />
      </footer>
    </div>
  );
}
