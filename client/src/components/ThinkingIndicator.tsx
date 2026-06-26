export function ThinkingIndicator({ visible = true }: { visible?: boolean }) {
  return (
    <div className={`thinking ${visible ? '' : 'thinking-hidden'}`}>
      <div className="thinking-label">Thinking</div>
      <div className="thinking-dots">
        <span className="thinking-dot" />
        <span className="thinking-dot" />
        <span className="thinking-dot" />
      </div>
    </div>
  );
}
