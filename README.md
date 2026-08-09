# Atlas — Global Development Insights

An AI chatbot that answers questions about world development with **live World Bank data**, rendered as charts inside the conversation. Ask *"Compare GDP per capita of India and Brazil since 2000"* and the model calls a typed frontend tool, fetches real indicator data, draws the chart, and summarizes the trend it actually received — it never invents numbers.

Deployed as a **Databricks App**, powered by **Databricks Foundation Model APIs** (Llama 3.3 70B), with a fully deterministic **Playwright** E2E suite.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router, TypeScript) | Standalone output for deployment |
| UI | shadcn/ui + Tailwind v4 | Cards, charts (Recharts), skeleton states |
| Agentic chat | CopilotKit | Runtime + `useCopilotAction` generative UI |
| LLM | Databricks Foundation Model APIs | OpenAI-compatible chat completions |
| Data | World Bank Open Data API | Public, no key, 9 curated indicators |
| E2E tests | Playwright | Hermetic: in-app mock LLM + fixture interception |
| Hosting | Databricks Apps | Asset Bundle deploy, OAuth M2M auth |

## Architecture

```
Browser ──► Next.js (Databricks App)
   │            ├─ /api/copilotkit ──► CopilotKit runtime (singleton, warmed)
   │            │                        └─► Databricks serving endpoint
   │            │                            (chat completions + tool calls)
   │            │                            auth: PAT (local) / OAuth M2M (deployed)
   │            ├─ /api/worldbank/series ──► World Bank Open Data API
   │            │                            (zod-validated, cached 24h)
   │            ├─ /api/mock-llm ─ deterministic scripted model (test mode only)
   │            └─ /api/health ─ liveness probe + runtime warm-up
   │
   └─ useCopilotAction("renderIndicatorChart")
        model requests tool → handler fetches data → chart renders in chat
        → data returns to model → model writes a grounded summary
```

The model is given one tool: `renderIndicatorChart(countries, indicatorId, startYear, endYear)`. The indicator catalog is a fixed allowlist ([src/lib/indicators.ts](src/lib/indicators.ts)) injected into the system prompt, so the model can't invent indicator codes and every tool call is validatable server-side.

## Design decisions worth reviewing

These came out of real debugging during the build, and each is documented where it lives in the code:

1. **The adapter pins the Chat Completions API** ([src/lib/chat-adapter.ts](src/lib/chat-adapter.ts)). CopilotKit's default OpenAI adapter resolves models through the AI SDK, which defaults to OpenAI's newer *Responses* API — an endpoint Databricks serving endpoints don't implement. The subclass forces `.chat()`, which both Databricks and the test mock speak.

2. **The CopilotKit runtime is a warmed singleton** ([src/lib/copilot-runtime.ts](src/lib/copilot-runtime.ts)). Two failure modes found via E2E: per-request runtime instances lose `agent/connect` state between HTTP requests (messages get silently dropped), and on a cold server the page's simultaneous connect calls can race first-time initialization — the client then marks the agent unavailable and never retries. `/api/health` warms the runtime, so platform health probes fix the cold-start case before a user ever hits it.

3. **The chat UI gates on agent readiness** ([src/app/page.tsx](src/app/page.tsx)). CopilotKit's context ships a no-op `sendMessage` until discovery completes; the UI exposes `isAvailable` as a `data-copilot-ready` attribute, shows a "Connecting…" state, and gives the E2E suite a deterministic wait target.

4. **E2E tests are hermetic** ([playwright.config.ts](playwright.config.ts)). With `LLM_PROVIDER=mock`, the app serves a scripted OpenAI-compatible model from within itself ([src/app/api/mock-llm/…](src/app/api/mock-llm/v1/chat/completions/route.ts)) that exercises the full tool-call loop — including streaming deltas and split tool-call arguments. World Bank responses are stubbed per-test with Playwright fixtures. No network, no model bill, no flakes; the same suite runs against the deployed app via `E2E_BASE_URL`.

5. **World Bank calls go through our own route** ([src/app/api/worldbank/series/route.ts](src/app/api/worldbank/series/route.ts)). One zod-validated surface: ISO-code and year-range validation, indicator allowlisting, 24-hour response caching, partial-failure reporting (chart renders what it can, names what's missing), and a clean interception point for tests.

6. **Auth rotates without restarts** ([src/lib/databricks-auth.ts](src/lib/databricks-auth.ts)). Locally a PAT from `.env.local`; inside Databricks Apps, the injected service principal's OAuth client-credentials flow. The token is attached per-request via a fetch wrapper, so the long-lived runtime never holds a stale credential.

7. **Deploys ship the prebuilt standalone bundle** ([scripts/deploy.sh](scripts/deploy.sh)). Databricks Apps allows `npm install` at startup, but a large dependency tree inside the 10-minute startup window is fragile. Building locally means the deployed artifact is byte-identical to what the E2E suite validated, and cold start is just `node server.js`. The script also enforces the platform's 10 MB per-file limit.

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in your workspace URL + PAT
npm run dev
```

`.env.local` needs a Databricks workspace (the [Free Edition](https://www.databricks.com/learn/free-edition) works) and a personal access token — see [.env.example](.env.example) for the exact fields. The World Bank API needs no credentials.

## Testing

```bash
npm run test:e2e          # full hermetic suite (builds + serves with mock LLM)
npm run test:e2e:ui       # same, in Playwright's UI mode
npm run test:e2e:live     # adds a live World Bank integration check
E2E_BASE_URL=https://<app-url> npx playwright test   # against a deployed app
```

11 tests cover: app shell and a11y basics, streaming text replies, the full tool-call → chart → summary loop, multi-country charts with partial failures, data-API error states, and input validation contracts for the World Bank route.

## Deploying

```bash
./scripts/deploy.sh
```

Builds, assembles the standalone bundle into `.appbuild/`, verifies file-size limits, deploys via a [Databricks Asset Bundle](databricks.yml), and starts the app. The bundle declares the serving endpoint as an app resource, so the platform auto-grants the app's service principal `CAN_QUERY` — no manual permission steps.

## With more time

- **RAG over Unity Catalog**: load World Bank metadata into a Vector Search index so the bot can answer "which indicator measures…" questions from documentation rather than the prompt catalog.
- **Conversation persistence** (Lakebase) and shareable chart permalinks.
- **Model routing**: the endpoint name is already env-driven; a quality/latency toggle between Llama 3.3 70B and Llama 4 Maverick would be a few lines.
- **CI**: the suite is already hermetic and CI-shaped (`forbidOnly`, retries, HTML report); wiring GitHub Actions is config-only.
- **Accessibility pass**: axe-core assertions in the E2E suite beyond the current lang/role/label checks.

## Known limitations

- Tool-call results return full time series to the model for summarization; for long ranges × many countries this spends tokens. A summary-stats-only variant would be cheaper but the chart needs the full series anyway.
- The World Bank API occasionally lags a year behind for some indicators; the chart footer names countries with no data rather than hiding them.
- CopilotKit's chat input manages composition state internally, so E2E tests type keystrokes rather than programmatic fills — slightly slower, but it exercises what users actually do.
