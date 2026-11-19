# Ship It Shop — Vercel Agent Foundations Certification

A Next.js storefront with **two AI agents** built for the Vercel Agent Foundations Certification:

1. **Shopping agent** — a customer-facing assistant (chat opens from the "Ask AI" header button, the floating "Ask AI" bubble, or the homepage CTA) that searches the catalog, explains products, and processes order returns.
2. **Store admin agent** — a password-protected back-office assistant at `/admin` (login: `letmeinadminagent`) with read-only store insights, a sandboxed bash tool, and persistent memory.

The storefront brand is **Ship It Shop**; it's backed by the live **Vercel Swag Store API** — there is no local product or cart database. Both agents run on the **AI SDK 7** with **durable Vercel Workflows**, so long chats survive server restarts and duplicate side effects (e.g. return notifications) are impossible.

## Tech stack

- **Next.js 16** (App Router) + **React 19**, TypeScript (`strict`), Tailwind CSS v4 + shadcn/ui, `lucide-react`
- **AI SDK 7**: `ai`, `@ai-sdk/react`, `@ai-sdk/workflow` (WorkflowAgent), **AI Elements** (`Conversation`, `PromptInput`, …) for generative UI
- **Durable state**: `workflow` + `@ai-sdk/workflow` — agents run as durable workflows with resumable streams (`/api/chat/[id]/stream`)
- **Model**: Vercel AI Gateway (`@ai-sdk/gateway`) by default, with an opt-in local-model path (`LOCAL_LLM_*`, e.g. Ollama) for development without gateway billing
- **Sandbox**: `@vercel/sandbox` for the admin agent's bash tool + persistent memory file
- **pnpm** (see `pnpm-lock.yaml`)

## Getting started

Prerequisites: Node.js 22+ and [pnpm](https://pnpm.io).

```bash
pnpm install
cp .env.example .env.local   # fill in BYPASS_SECRET (or run `vercel env pull`)
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The storefront only needs `BYPASS_SECRET`. The agents also need a model provider: the **AI Gateway** (works out of the box on Vercel via OIDC; locally use `AI_GATEWAY_API_KEY`) or a **local model** (set `LOCAL_LLM_BASE_URL` + `LOCAL_LLM_MODEL` to run against e.g. Ollama — no key needed).

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `BYPASS_SECRET` | Yes | Vercel deployment-protection bypass secret, sent as `x-vercel-protection-bypass` on every server-side API call. **Server-only — never `NEXT_PUBLIC_`.** |
| `API_BASE_URL` | No | Override the backend API base URL. Defaults to `https://vercel-agentic-swag-store-api.vercel.app/api`. |
| `AI_GATEWAY_API_KEY` | No | Gateway API key for the agent model when running locally. Not needed on Vercel (OIDC). |
| `LOCAL_LLM_BASE_URL` | No (dev) | OpenAI-compatible local model server (e.g. `http://localhost:11434/v1`). Bypasses the gateway. **Never set in the Vercel project environment.** |
| `LOCAL_LLM_MODEL` | No (dev) | Local model id (e.g. `lfm2.5:latest`). |
| `LOCAL_LLM_API_KEY` | No (dev) | Optional; most local servers ignore it. |
| `AGENT_MODEL` | No | Override the gateway model id (default `anthropic/claude-haiku-5.5`). |
| `ADMIN_PASSWORD` | No | Admin agent password. Defaults to the demo `letmeinadminagent`. Override only if needed. |
| `VERCEL_OIDC_TOKEN` | No (local) | Project OIDC token (`vercel env pull`) used by the Sandbox SDK outside Vercel. |
| `NEXT_PUBLIC_SITE_URL` | No | Public site URL for metadata. Defaults to `http://localhost:3000`. |

`.env.local` is gitignored; `.env.example` is the redacted template. **Do not** set `LOCAL_LLM_*` in the Vercel project.

## Architecture

### Agent layer (shared)

- `lib/gateway.ts` — model resolution: `resolveAgentModel()` returns the gateway model id (string) by default; when `LOCAL_LLM_BASE_URL` is set it returns a serializable `LocalWorkflowModel` wrapper that survives durable-step serialization (`@workflow/serde` custom-class serialization).
- `lib/workflows/*.ts` — `"use workflow"` orchestrators. Each chat is one durable workflow run; the UI streams from it and can reconnect to the same run after a refresh (`/api/chat/[id]/stream`, `/api/admin/chat/[id]/stream`).
- `app/api/chat/route.ts` + `app/api/admin/chat/route.ts` — POST endpoints that `start()` a workflow and return the run id; the `/stream` routes re-attach and replay (`x-workflow-stream-tail-index`).

### Shopping agent

- `lib/tools.ts` — `searchProducts`, `getAllCategories`, `getProductDetails`, `returnOrder`. Every `execute` is a durable `"use step"`; errors return `{ error }`, never throw.
- `returnOrder` starts a **child return flow** (`lib/workflows/return-flow.ts`) with one `"use step"` per side effect (notify, preauthorize, file), so a retry re-runs only the failed step — the shopper sees confirmation instantly when the workflow starts.
- UI: `components/agent-chat.tsx` (AI Elements) with generative UI for product cards in `components/agent-tool-parts.tsx`.

### Admin agent

- `/admin` (login `letmeinadminagent`) → `components/admin-agent-chat.tsx`, posting to `/api/admin/chat`.
- `lib/admin-tools.ts` — read-only back-office tools: `getSupportTickets`, `getReturnsHistory`, `getInventoryStock`, `getSalesAnalytics`, plus catalog `searchProducts`/`getAllCategories`, plus **`bash`**: runs `bash -lc` inside a persistent Vercel Sandbox (`lib/sandbox.ts`, sandbox name `swag-store-backoffice`). The tool surface is admin-only: both admin API routes check the `admin_auth` cookie themselves (`proxy.ts` only guards `/admin/:path*` pages) and return 401 otherwise.
- **Memory**: the sandbox holds a persistent `memories.md`. `readMemories()` loads it at conversation start and injects it into the agent instructions; the agent appends to it via bash using the documented memory protocol (reusable scripts land in `/vercel/sandbox/scripts/`).
- Generative UI in `components/admin-tool-parts.tsx`: bash running/exit/failure states, tickets/returns/stock/sales tables, catalog grid.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Dev server on http://localhost:3000 |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Wired to `eslint .`; ESLint is not installed — fails until a linter is added |

No test framework is configured.

## Security

- `BYPASS_SECRET` and the admin password live server-side only (route handlers / Server Actions / env); no `NEXT_PUBLIC_` aliases exist.
- Admin auth is **demo-grade** (password = cookie value). Sufficient for the certification, not for production — swap in an opaque token or signed cookie before real use (`ADMIN_PASSWORD` env override keeps the change config-only).
- The admin agent is **read-only** with respect to the store: mutations only happen through the customer flow (`returnOrder`), never from admin tools; admin "computation" is confined to the sandbox.
- `.env.local` is gitignored; never commit secrets.

## Deployment

Deploys to Vercel with the standard flow (`vercel --prod`, or git push to `main` if the project has a Git integration). Required project env vars: `BYPASS_SECRET`, `API_BASE_URL` (both already set on this project). The workflows registers `/.well-known/workflow/v1/flow` and `/.well-known/workflow/v1/webhook/[token]` automatically via `withWorkflow()` in `next.config.mjs`.

`images.remotePatterns` in `next.config.mjs` is whitelisted for the Vercel Blob hosts that serve product images; add hostnames there if the API ever serves images from a new domain.
