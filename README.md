# Fiscal

**Financial scenario simulator, built as an OKX A2MCP Agent Service Provider on X Layer.**

Describe any financial decision in plain English — crypto or traditional finance — and Fiscal pulls live market data, runs five independent scenarios, and returns a structured risk/reward report with a direct recommendation. Built for both human use (via the web UI) and AI agent use (via MCP tool call), with x402 on-chain payment gating for programmatic access.

- **MCP endpoint:** `https://fiscal-stable.vercel.app/api/mcp`
- **Live app:** `https://fiscal-stable.vercel.app`
- **Agent ID:** `#4826` (OKX.AI)
- **Category:** Finance Copilot / Software Utility
- **Pricing:** 0.3 USDT per call

---

## Table of Contents

1. [MCP Integration](#mcp-integration)
2. [x402 Payment Gate](#x402-payment-gate)
3. [Architecture](#architecture)
4. [API Reference](#api-reference)
5. [Local Setup](#local-setup)
6. [Environment Variables](#environment-variables)
7. [Scenario Engine](#scenario-engine)
8. [Deployment](#deployment)
9. [Frontend](#frontend)

---

## MCP Integration

Fiscal exposes its core simulation logic as a discoverable **MCP (Model Context Protocol)** tool, so any MCP-compatible AI agent — Claude Code, Cursor, Codex, OpenClaw, or a custom agent — can call it directly without going through the web UI.

### Endpoint

```
POST https://fiscal-stable.vercel.app/api/mcp
```

Built with [`mcp-handler`](https://www.npmjs.com/package/mcp-handler) (Vercel's official MCP adapter for Next.js), using Streamable HTTP transport. This avoids the incompatibility between the raw `@modelcontextprotocol/sdk` (which expects Node's native `http` req/res streaming) and Next.js App Router's Web Fetch API-based route handlers.

### Exposed Tool

**`simulate_financial_decision`**

| Field | Type | Description |
|---|---|---|
| `decision` | `string` (min 10 chars) | The financial decision in plain English, e.g. *"Should I put $5k into ETH or hold USDC for 3 months?"* |

**Returns:** a JSON-serialized `SimulationReport` — see [Scenario Engine](#scenario-engine) for the full shape.

### How an agent calls it

Any MCP client following the Streamable HTTP transport spec can:

1. `GET /api/mcp` — discover the server and its tool list
2. `POST /api/mcp` with a `tools/call` request for `simulate_financial_decision`, passing `{ "decision": "..." }`
3. Receive the structured report back as tool output

No API key is required for basic MCP discovery (`tools/list`). Actual invocation is protected by the same auth/rate-limit gate described below, and — once fully wired — the x402 payment layer for paid, agent-initiated calls.

### File

```
app/api/mcp/route.ts
```

---

## x402 Payment Gate

Fiscal charges **0.3 USDT per call** via the [x402 protocol](https://x402.org) on **X Layer** (`eip155:196`), using OKX's Onchain OS payment SDK. This lets any AI agent with an Agentic Wallet pay for a simulation autonomously — no API keys, no subscriptions, no human in the loop.

### Why a separate route

The OKX x402 SDK (`@okxweb3/x402-express`) ships as **Express middleware** — `(req, res, next)` style. Next.js **App Router** route handlers use Web Fetch API `Request`/`Response` objects instead, which aren't directly compatible with Express middleware.

Next.js **Pages Router** API routes, by contrast, are built directly on Node's raw `http` req/res — the same shape Express expects. So the payment-gated endpoint lives there instead:

```
pages/api/paid-simulate.ts    →    POST /api/paid-simulate
```

This coexists fine alongside the `app/` directory in the same project — Next.js supports both routers simultaneously.

### Payment flow

```
1. Agent calls POST /api/paid-simulate
2. No payment attached -> Fiscal responds 402 Payment Required
   (includes price, accepted token, network, and PAY_TO address)
3. Agent's wallet signs a payment authorization
4. Agent retries the same request with a PAYMENT-SIGNATURE header
5. Fiscal forwards the signature to OKX's Facilitator for verification + settlement
6. Facilitator confirms on-chain (X Layer, zero gas for USDT/USDG)
7. Fiscal returns 200 OK with the simulation report
```

All of steps 2-6 are handled by `paymentMiddleware` from `@okxweb3/x402-express` — Fiscal's own code only implements the actual simulation logic behind it.

### Settlement method

**Instant Payment** (synchronous, on-chain settlement per request) — appropriate for Fiscal's low-frequency, single-call usage pattern. (Batch Payment is better suited to high-frequency micropayment scenarios, which doesn't fit here.)

### Required credentials

| Variable | Source |
|---|---|
| `OKX_API_KEY`, `OKX_SECRET_KEY`, `OKX_PASSPHRASE` | [OKX Developer Portal](https://web3.okx.com/onchainos/dev-portal) |
| `PAY_TO_ADDRESS` | Your Agentic Wallet's EVM address on X Layer |

### Packages

```
express
@okxweb3/x402-express
@okxweb3/x402-core
@okxweb3/x402-evm
```

---

## Architecture

```
                     +---------------------------+
                     |   AI Agent (any MCP        |
                     |   client, or x402 buyer)   |
                     +-------------+---------------+
                                   |
              +---------------------+---------------------+
              v                                           v
   POST /api/mcp                              POST /api/paid-simulate
   (tool discovery + call,                    (x402-gated, on-chain
    auth/rate-limit gated)                     paid per call)
              |                                           |
              +---------------------+---------------------+
                                   v
                     lib/parser.ts (Groq -- decision -> structured JSON)
                                   v
                     lib/simulator.ts (5-scenario engine)
                                   v
                     lib/fetcher.ts (CoinGecko / Alpha Vantage,
                                     synthetic fallback if live fetch fails)
                                   v
                        SimulationReport (JSON)
```

The human-facing web UI (`app/page.tsx`) calls the free, non-gated `app/api/simulate/route.ts` endpoint directly — it shares the same `parser.ts` / `simulator.ts` core, just without the MCP or payment wrapping.

---

## API Reference

| Route | Router | Auth | Purpose |
|---|---|---|---|
| `POST /api/simulate` | App | Rate-limit + optional secret | Human-facing UI endpoint, free |
| `POST /api/chat` | App | Rate-limit + optional secret | Follow-up chat on a generated report |
| `POST /api/mcp` | App | Rate-limit + optional secret | MCP tool discovery + invocation |
| `POST /api/paid-simulate` | Pages | x402 payment required | Agent-facing, paid per call |
| `GET /api/health` | App | None | Uptime check for OKX's functional verification |

### `POST /api/simulate` request/response

```json
// Request
{ "input": "Should I put $5k into ETH or hold USDC for 3 months?" }

// Response -- SimulationReport (see Scenario Engine below)
```

### `GET /api/health`

```json
{ "status": "ok", "service": "fiscal", "timestamp": "..." }
```

---

## Local Setup

```bash
git clone <your-repo-url>
cd fiscal
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` is required due to a peer dependency conflict between `mcp-handler` and `@modelcontextprotocol/sdk` (also enforced automatically via `.npmrc` on Vercel builds).

Copy `.env.local.example` -> `.env.local` and fill in your keys (see below), then:

```bash
npm run dev
```

Visit `http://localhost:3000`.

---

## Environment Variables

```bash
# Core simulation engine
GROQ_API_KEY=               # Groq -- llama-3.3-70b-versatile
COINGECKO_API_KEY=          # crypto price history
ALPHA_VANTAGE_API_KEY=      # stock/TradFi price history

# Request protection (app/api routes)
FISCAL_API_SECRET=          # leave blank locally; set a random string in production

# x402 payment gate (pages/api/paid-simulate)
OKX_API_KEY=
OKX_SECRET_KEY=
OKX_PASSPHRASE=
PAY_TO_ADDRESS=             # Agentic Wallet EVM address on X Layer
FISCAL_PRICE_USD=$0.30
```

Generate `FISCAL_API_SECRET` with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Scenario Engine

Every simulation runs **5 independent scenarios** against the parsed decision — not multipliers of historical movement, but distinct, realistic outcome models:

| Scenario | Model |
|---|---|
| **Historical Base** | Actual price movement over the stated horizon, pulled live |
| **Bull Case** | Favorable conditions -- asset-class and horizon-specific upside |
| **Bear Case** | Adverse conditions -- asset-class and horizon-specific downside |
| **Volatility Spike** *(crypto)* / **Recession** *(TradFi)* | Sharp drawdown stress scenario |
| **Sideways / Macro Pressure** *(crypto)* / **Rate Hike** *(TradFi)* | Low-movement, headwind scenario |

Stablecoins (USDC, USDT, DAI, or generic terms like "stablecoin") are always modeled near 0% across every scenario -- they don't inherit crypto-asset volatility.

**Report shape:**
```typescript
{
  decision: ParsedDecision,      // assets, amount, horizon, domain, risk context
  scenarios: Scenario[],          // 5 entries, each with per-asset outcomes + verdict
  riskScore: number,              // 1-10
  recommendation: string,
  reasoning: string,
  generatedAt: string
}
```

If live data fetch fails for an asset, the engine falls back to synthetic price generation using known volatility profiles -- the simulation never hard-fails, and the report flags which assets used estimated data.

---

## Deployment

Deployed on **Vercel** -- chosen specifically because serverless functions here are always publicly reachable over HTTPS immediately on deploy, with no persistent-server sleep/suspend risk.

```bash
git push
```
Vercel auto-deploys on push to `main`. Set all environment variables above in **Project -> Settings -> Environment Variables**.

**Before submitting/resubmitting to OKX review:** hit `/api/health` manually once to warm the function, avoiding a cold-start timeout on OKX's first verification request.

---

## Frontend

The web UI (`app/page.tsx` + `components/ReportView.tsx`) is a secondary, human-facing surface -- useful for manual testing, but **not required** for the ASP's actual function. The paying "customer" in the A2MCP/x402 model is an AI agent calling `/api/mcp` or `/api/paid-simulate` directly.

**Design system:** financial brutalism -- black background (`#0a0a0a`), lime accent (`#c8ff00`), JetBrains Mono throughout, hard edges, no gradients.

- `app/page.tsx` -- input screen, example prompts, entry animations
- `components/LoadingScreen.tsx` -- full-screen step tracker during simulation
- `components/ReportView.tsx` -- scenario table, risk score, recommendation, follow-up chat
- `app/globals.css` -- design tokens (CSS custom properties)

Chat follow-up (`app/api/chat/route.ts`) uses the generated report as system context, so users can ask things like *"what happens if ETH drops 50%?"* without re-running the full simulation.
