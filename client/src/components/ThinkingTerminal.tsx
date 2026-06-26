import { useRef, useEffect } from 'react';

interface Props {
  modelName: string;
  text: string;
  isLive: boolean;
}

export function ThinkingTerminal({ modelName, text, isLive }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [text]);

  // Separate <think>...</think> reasoning from output
  const thinkMatch = text.match(/<think>([\s\S]*?)(<\/think>|$)/i);
  const reasoning = thinkMatch ? thinkMatch[1].trim() : null;
  const output = text.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();

  return (
    <div className={`terminal ${isLive ? 'terminal-live' : text ? 'terminal-done' : 'terminal-idle'}`}>
      <div className="terminal-titlebar">
        <div className="terminal-dots">
          <span className={`terminal-dot ${isLive ? 'dot-red' : 'dot-dim'}`} />
          <span className="terminal-dot dot-dim" />
          <span className="terminal-dot dot-dim" />
        </div>
        <span className="terminal-title">
          {modelName} {isLive ? '— thinking...' : text ? '— done' : '— idle'}
        </span>
      </div>
      <div className="terminal-body" ref={bodyRef}>
        {!text && !isLive && (
          <span className="terminal-idle-text">Waiting for turn...</span>
        )}
        {reasoning && (
          <div className="terminal-reasoning">
            <span className="terminal-prefix">💭</span>
            {reasoning}
          </div>
        )}
        {output && (
          <div className="terminal-output">
            <span className="terminal-prefix">&gt;</span>
            {output}
          </div>
        )}
        {isLive && <span className="terminal-cursor">▊</span>}
      </div>
    </div>
  );
}
