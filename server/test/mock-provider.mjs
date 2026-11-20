import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { Chess } from 'chess.js';

export function createMockProvider() {
  const requests = [];
  const server = createServer(async (req, res) => {
    const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.url === '/__test/requests') return send(200, requests);
    if (req.method === 'GET') {
      const data = ['gpt-6.1-terra', 'gpt-4o', 'claude-sonnet-4-6', 'claude-opus-4-7', 'llama3.1', 'unavailable-model']
        .map((id) => ({ id, name: id, display_name: id }));
      return send(200, { data, models: data, has_more: false });
    }
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    requests.push({
      path: req.url, body,
      authorized: !!req.headers.authorization, anthropicKey: !!req.headers['x-api-key'],
    });
    if (body.model === 'unavailable-model') return send(404, { error: { message: 'Model not found', code: 'model_not_found' } });
    if (body.model === 'gpt-6.1-terra') {
      if ('max_tokens' in body) return send(400, { error: { param: 'max_tokens', code: 'unsupported_parameter', message: 'Use max_completion_tokens instead' } });
      if ('temperature' in body) return send(400, { error: { param: 'temperature', code: 'unsupported_value', message: 'Only default temperature is supported' } });
    }
    if (body.model === 'claude-opus-4-7' && 'temperature' in body) {
      return send(400, { error: { message: 'temperature is not supported for this model' } });
    }
    const prompt = body.messages?.at(-1)?.content || '';
    const position = /(?:Available positions|Available):\s*([1-9])/i.exec(prompt)?.[1] || '1';
    let text = `MOVE: ${position}`;
    const fen = /Position \(FEN\): ([^\n]+)/.exec(prompt)?.[1];
    if (fen) {
      const chess = new Chess(fen);
      const moves = chess.moves({ verbose: true });
      const move = moves.find((candidate) => candidate.piece === 'p') || moves[0];
      text = `MOVE: ${move.from}${move.to}${move.promotion || ''}`;
    }
    if (body.model === 'always-invalid' || (body.model === 'retry-once' &&
      requests.filter((request) => request.body.model === body.model).length === 1)) text = 'invalid response';
    if (req.url.endsWith('/messages')) return send(200, { content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 4 } });
    if (req.url.endsWith('/api/chat')) return send(200, { message: { content: text }, eval_count: 14 });
    send(200, { choices: [{ message: { content: text } }], usage: { total_tokens: 14 } });
  });
  return { server, requests };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { server } = createMockProvider();
  server.listen(Number(process.env.MOCK_PORT || 43124), '127.0.0.1', () => console.log(`Mock provider ready on ${server.address().port}`));
}
