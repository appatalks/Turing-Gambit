<div align="center">

<img src="images/turing-gambit-splash.png" alt="Turing-Gambit" width="680" />

# ♔ Turing-Gambit ♚

**Watch AI models play chess against each other — or play against them yourself.**

A beautiful desktop app where two AI models battle on the board in real time.

[**⬇ Download**](#-download--install) · [Features](#features) · [How to Play](#how-to-play) · [For Developers](#for-developers)

</div>

---

## ⬇ Install

One command to download, install, and add to your app menu:

```bash
curl -fsSL https://raw.githubusercontent.com/appatalks/Turing-Gambit/main/install.sh | bash
```

Then launch:

```bash
turing-gambit
```

Or search for **Turing-Gambit** in your application menu (GNOME, KDE, etc).

<details>
<summary>What the installer does</summary>

- Checks for Node.js 18+ and git
- Clones the repo to `~/.local/share/turing-gambit`
- Installs all dependencies (npm)
- Sets up the Electron binary
- Creates a `turing-gambit` command in `~/.local/bin`
- Adds a desktop menu entry with the app icon
- Running it again will update to the latest version

</details>

> **Prerequisites:** [Node.js 18+](https://nodejs.org) and git.<br>
> On Ubuntu/Debian: `sudo apt install nodejs npm git`

> 💡 The app checks for updates on launch and prompts you to upgrade when new versions are available. Disable in Settings if you prefer.

---

## How to Play

1. **Open the app** — you'll see the match setup screen
2. **Pick your players** — choose an AI model for White and Black (or pick **Human** to play yourself)
3. **Add your keys** *(if needed)* — click the ⚙ **Settings** gear and paste in any API keys
4. **Press Start** — watch the models think and play in real time!

### Which AI models can I use?

| Option | What you need | Cost |
|---|---|---|
| **GitHub Copilot** | A Copilot subscription + the [Copilot CLI](https://github.com/github/copilot-cli) | Included with Copilot |
| **OpenAI** (GPT-4o, etc.) | An OpenAI API key | Pay per use |
| **Anthropic** (Claude) | An Anthropic API key | Pay per use |
| **Ollama** | [Ollama](https://ollama.com) running on your computer | Free |
| **LM Studio** | [LM Studio](https://lmstudio.ai) running on your computer | Free |
| **OpenAI Compatible** | A Chat Completions endpoint and its API key, if required | Depends on endpoint |
| **Human (You)** | Nothing — just play! | Free |

For OpenAI-compatible Chat Completions models, Turing-Gambit can switch to `max_completion_tokens` or omit `temperature` when the endpoint explicitly rejects those parameters. The exact model ID must be available to your API key on the selected endpoint. If a non-retryable request error remains, the match stops and shows the provider error instead of retrying it as an invalid move.

### Model picker and balanced settings

Each player has an **Available Models** picker. Models are fetched from the selected provider (Copilot ACP, Ollama `/api/tags`, or the provider's models API). Save cloud keys in Settings, then use **Refresh Models**. Custom IDs remain editable when discovery is unavailable. Discovery lists account/server models, but does not guarantee every listed model supports chat.

Model discovery only contacts approved endpoints: the standard OpenAI/Anthropic APIs, local Ollama/LM Studio ports, and server-configured endpoints. For a custom host or port, set `MODEL_ENDPOINT_ALLOWLIST` to a comma-separated list of trusted base URLs in the server environment (for example `http://localhost:8080,https://models.example.com`). The picker cannot approve an endpoint itself, and discovery does not follow redirects. Manual model IDs remain usable without discovery.

**Use balanced model settings** applies conservative gameplay defaults:

- OpenAI GPT-5/GPT-6 and o-series reasoning models: low reasoning effort, provider-default sampling, and 8192 completion tokens including reasoning.
- Other chat models: temperature 0.3 and 2048 output tokens. Recent Claude models that do not support sampling use the provider default.
- Copilot: the CLI manages sampling and output limits; ACP does not expose those controls.

Uncheck the option for advanced/manual temperature and output-budget overrides. An empty per-player token budget inherits **Max Tokens per Move**. Automatic mode uses its model-specific budget instead. Previously saved configurations remain manual until you opt in.

In the desktop app, **Check for updates on launch** persists through Electron to the same preference file the launcher reads. In a web browser this desktop-only control is disabled. Appearance and update preferences take effect immediately; **Save** stores API keys.

Run `npm --prefix server test` after installing both server and client dependencies to check model discovery, request settings, Socket.IO matches, parameter fallbacks, input validation, and Electron preference persistence. Tests use local HTTP fixtures and make no paid inference calls.

For the real desktop settings round-trip, build the app and run a web server (`PORT=43123 npm --prefix server start`), then run `TG_E2E_URL=http://127.0.0.1:43123 npm run test:electron-settings`. This uses an isolated Electron profile and verifies renderer → preload → IPC → disk persistence across a reload; it does not modify your installed app's preferences.

> 🆓 **Want it completely free?** Install [Ollama](https://ollama.com) or [LM Studio](https://lmstudio.ai), download a model, and pick it in Turing-Gambit. No API keys, no cost, runs entirely on your machine.

---

## Features

| | |
|---|---|
| ♟️ **Real-time chess** | Animated board, captured pieces, move history, live game status |
| 🎲 **10 games** | Chess, Checkers, WarGames, Tic-Tac-Toe, Connect Four, Dots & Boxes, Battleship, Prisoner's Dilemma, Debate, and Risk |
| 🤖 **AI vs AI** | Pit any two models against each other and watch them battle |
| 🧑 **Human vs AI** | Play as White or Black against any model — just drag the pieces |
| 💭 **Live thinking** | See each model's reasoning stream in real-time terminal windows |
| ⏱️ **Match timer** | Tracks total and per-side thinking time |
| 📊 **Metrics** | Latency, token usage, errors, and full match transcripts |
| 💾 **Export** | Save games as PGN or JSON |
| 🎨 **Themes** | Four color themes + adjustable transparency |
| 🎵 **Music** | Play your own music folder during matches |
| 🔄 **Auto-update** | Get notified when a new version is released |

---

## For Developers

Want to run from source or contribute?

```bash
git clone https://github.com/appatalks/Turing-Gambit.git
cd Turing-Gambit
npm install && npm run install:all

npm run desktop      # Launch the desktop app
npm run dev          # Or run as a web app at http://localhost:5173
```

### Build installers

```bash
npm run dist:linux   # AppImage + deb
npm run dist:mac     # dmg
```

<details>
<summary><b>Architecture & internals</b></summary>

```
Turing-Gambit/
├── server/                   # Express + Socket.IO backend
│   └── src/
│       ├── providers/        # AI provider adapters (Copilot, OpenAI, Anthropic, Ollama)
│       ├── games/chess/      # Chess engine + prompt builder
│       ├── match-manager.ts  # Match lifecycle, game loop, move validation
│       └── index.ts          # Server entry
├── client/                   # React + Vite + TypeScript frontend
├── electron/                 # Electron main process + app icons
└── package.json              # Root scripts
```

**How it works:**
1. Select providers/models for White and Black (or Human)
2. The server sends the position + legal moves to each model per turn
3. Responses are parsed (UCI → SAN fallback → `<think>` block stripping) and validated with chess.js
4. Invalid moves trigger a correction prompt (configurable retries)
5. Match state streams to the UI via Socket.IO

**Provider interface** — all providers implement:

```typescript
interface AIProvider {
  getMove(request: MoveRequest): Promise<MoveResponse>;
  dispose?(): void;
}
```

The Copilot provider talks to the CLI over the Agent Client Protocol (ACP), creating a fresh session per move for clean context.

</details>

## License

MIT

---

## Built With Eva-Agent

This project was created with technology developed in [Eva-Agent](https://github.com/appatalks/eva-agent/).

<p align="center">
  <a href="https://github.com/appatalks/eva-agent/"><img src="images/Built_with_Eva-Agent.png" alt="Built with Eva-Agent" width="420"></a>
</p>
