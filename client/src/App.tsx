import { useState, useCallback, useRef, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import { MatchConfigPanel } from './components/MatchConfig';
import { ChessBoardView } from './components/ChessBoard';
import { CheckersBoardView } from './components/CheckersBoard';
import { WarGamesBoardView } from './components/WarGamesBoard';
import { TicTacToeBoard } from './components/TicTacToeBoard';
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
import { Scoreboard } from './components/Scoreboard';
import { recordResult } from './lib/scoreboard';
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
  const [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [logCollapsed, setLogCollapsed] = useState(false);
  const [autoPlay, setAutoPlay] = useState(() => localStorage.getItem('tg-autoplay') === '1');
  const musicRef = useRef<MusicPlayerHandle>(null);
  const lastConfigRef = useRef<MatchConfig | null>(null);
  const recordedRef = useRef<string | null>(null);

  const handleStart = useCallback((config: MatchConfig) => {
    setKeys(loadSavedKeys());
    lastConfigRef.current = config;
    startMatch(config);
  }, [setKeys, startMatch]);

  const toggleAutoPlay = useCallback(() => {
    setAutoPlay((v) => {
      const next = !v;
      localStorage.setItem('tg-autoplay', next ? '1' : '0');
      return next;
    });
  }, []);

  // Record results + auto-rematch when a match completes
  useEffect(() => {
    if (matchState?.status === 'completed' && matchState.winner) {
      if (recordedRef.current !== matchState.id) {
        recordedRef.current = matchState.id;
        recordResult(matchState);

        // Auto-play: start a new match after a short delay (AI vs AI only)
        const isAIvsAI = matchState.white.type !== 'human' && matchState.black.type !== 'human';
        if (autoPlay && isAIvsAI && lastConfigRef.current) {
          const cfg = lastConfigRef.current;
          setTimeout(() => {
            setKeys(loadSavedKeys());
            startMatch(cfg);
          }, 4000);
        }
      }
    }
  }, [matchState?.status, matchState?.id, autoPlay]);

  // ── Config screen ────────────────────────────────
  if (!matchState) {
    return (
      <div className="app">
        <WindowControls onSettings={() => setSettingsOpen(true)} onMusicFiles={(f) => musicRef.current?.loadFiles(f)} />
        <div className="connection-dot" data-connected={connected} title={connected ? 'Connected' : 'Disconnected'} />
        {error && <div className="error-toast">{error}</div>}
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onSave={setKeys} />
        <Scoreboard open={scoreboardOpen} onClose={() => setScoreboardOpen(false)} />
        <button className="btn btn-secondary trophy-btn" onClick={() => setScoreboardOpen(true)} title="Scoreboard">🏆</button>
        <MusicPlayer ref={musicRef} />
        <MatchConfigPanel onStart={handleStart} autoPlay={autoPlay} onToggleAutoPlay={toggleAutoPlay} />
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
      <Scoreboard open={scoreboardOpen} onClose={() => setScoreboardOpen(false)} currentGame={matchState.game} />

      {/* Victory / game-over splash — hidden during auto-play AI rematches */}
      {!(autoPlay && matchState.white.type !== 'human' && matchState.black.type !== 'human') && (
        <VictorySplash state={matchState} onNewMatch={resetMatch} />
      )}

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
          <button className="btn btn-secondary btn-icon" onClick={() => setScoreboardOpen(true)} title="Scoreboard" style={{ opacity: 0.7 }}>🏆</button>
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
          ) : matchState.game === 'wargames' ? (
            <WarGamesBoardView
              boardState={fen}
              interactive={isHumanTurn}
              onHumanMove={submitHumanMove}
              legalMoves={matchState.legalMoves || []}
            />
          ) : matchState.game === 'tictactoe' ? (
            <TicTacToeBoard
              boardState={fen}
              interactive={isHumanTurn}
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
