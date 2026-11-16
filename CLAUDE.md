# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (see `pnpm-lock.yaml`).

- `pnpm dev` — start the Next.js dev server on http://localhost:3000
- `pnpm build` — production build
- `pnpm start` — serve the production build
- `pnpm lint` — wired but `eslint` is not installed; the script will fail until a linter is added

There is no test framework wired up.

## Stack

- **Next.js 16** App Router with **React 19**
- **TypeScript** with `strict: true`, `@/*` path alias maps to the project root
- **Tailwind CSS v4** (PostCSS plugin); theme tokens are CSS variables defined in `app/globals.css`
- **shadcn/ui** (new-york style, neutral base) — components live in `components/ui/`, generator config in `components.json`. Use `cn()` from `lib/utils.ts` for class merging
- **lucide-react** for icons

## Environment

`.env.local` (gitignored) holds:

- `BYPASS_SECRET` — required. Sent as the `x-vercel-protection-bypass` header on every API call. Must never be exposed to the client (no `NEXT_PUBLIC_` prefix).
- `API_BASE_URL` — optional. Defaults to `https://vercel-agentic-swag-store-api.vercel.app/api` in `lib/api.ts`.

`.env.example` is the redacted template for new developers.

## Architecture

The storefront brand is **Ship It Shop** (metadata, header, homepage copy). The store is backed by the live **Vercel Swag Store API** (no local product/cart database). The protection-bypass secret stays server-side: every API read happens in a Server Component or Server Action, every cart mutation goes through a Server Action, and the cart token cookie is `httpOnly`.

### Data layer (`lib/`)

- `lib/types.ts` — pure type module re-exporting the API schemas (`Product`, `CartWithProducts`, `CartItemWithProduct`, `Promotion`, `Category`, `StockInfo`, `StoreConfig`). Both server and client modules import from here. Also exports the `CATEGORY_SLUGS` const tuple used by the category filter.
- `lib/api.ts` — typed `fetch` wrapper. Functions: `getProducts`, `getProductById`, `getProductStock`, `getCategories`, `getPromotion`, `getStoreConfig`, `cartCreate`, `cartGet`, `cartAdd`, `cartUpdate`, `cartRemove`. **Server-only** by convention (reads `process.env.VERCEL_PROTECTION_BYPASS_SECRET`). Throws `ApiRequestError` on non-200/`success:false` responses.
- `lib/cart-token.ts` — `getOrCreateCartToken()`/`getCartToken()`/`clearCartToken()` using `next/headers`. Stores the API-issued cart UUID in an `httpOnly` cookie `cart_token` with a 30-day max-age.
- `lib/cart-actions.ts` — `'use server'` actions: `getCartAction`, `addToCartAction`, `updateCartItemAction`, `removeCartItemAction`, `getProductStockAction`. Each cart mutation calls the API and `revalidateTag('cart')`. The first add lazily creates the cart on the server.
- `lib/format.ts` — `formatPrice(cents, currency)` using `Intl.NumberFormat`. **API prices are integers in cents**, so always pass them through this helper.
- `components/cart-provider.tsx` — Client `CartProvider` that hydrates the cart on mount by calling `getCartAction()` (so the layout can stay synchronous and routes can be statically rendered). Mutations dispatch through Server Actions inside `startTransition`, with `useOptimistic` for snappy UI.

### Caching strategy

Classic App Router (Cache Components / `'use cache'` are intentionally **not** used).

- Read endpoints (`getProducts`, `getProductById`, `getCategories`, `getPromotion`, `getStoreConfig`) pass `next: { revalidate: 300, tags: [...] }` to `fetch`. Tags: `products`, `product:{id}`, `categories`, `promotion`, `store-config`.
- `getProductStock` uses `cache: 'no-store'` so the indicator reflects live inventory.
- All cart endpoints use `cache: 'no-store'`. Mutations call `revalidateTag('cart')`, primarily for navigation re-renders — same-page UI relies on the action's return value + `useOptimistic`.

### Routes (App Router)

- `/` (`app/page.tsx`) — **Static** (`○`). Synchronous parent component renders three siblings (`<PromoBanner />`, `<FeaturedProducts />`, `<CategoryShowcase />`) so async children fan out in parallel. Each handles its own data fetch.
- `/search` (`app/search/page.tsx`) — **Dynamic** (`ƒ`, by necessity — uses `searchParams`). Reads `q` and `category`, fetches categories + products in parallel via `Promise.all`, and renders results inline (no `Suspense`). Loading feedback is a spinner inside `<SearchForm />` driven by `useTransition`.
- `app/search/search-form.tsx` — Client. `next/form` `<Form>` for the no-JS fallback, debounced 300ms `router.replace` wrapped in `startTransition` once `q.length >= 3` (or back to empty), `<Select>` from shadcn for the category dropdown.
- `/products/[param]` (`app/products/[param]/page.tsx`) — **SSG** (`●`). The `param` accepts both product **id** and **slug** (the API resolves either). `generateStaticParams` enumerates products via `getProducts({ limit: 100 })`; `generateMetadata` builds title, description, and `openGraph`/`twitter` cards using `product.images`. The page renders product image, name, price, description server-side; the only client island is `<ProductPurchase />`.
- `app/products/[param]/product-purchase.tsx` — Client. Stock + qty selector + Add-to-Cart. Fetches stock on mount via `getProductStockAction`, polls every 30s. Initial render shows "Checking availability…" until the action resolves; this is the cost of keeping the product page statically renderable.
- `app/products/[param]/related-products.tsx` — Server, async. `getProducts({ category, limit: 8 })`, filters out the current product, slices to 4.

### Layout

`app/layout.tsx` is **synchronous** so it doesn't opt routes out of static rendering. It mounts `<Header />` (server) — which contains `<CartButton />` (client) — `<Footer />`, `<CartProvider>` (no initial cart prop; provider hydrates client-side), and `<CartSheet />`. `metadataBase`, `title.template`, and root `openGraph`/`twitter` defaults live here.

### Client / server split

Client components are kept minimal — only where state, effects, or browser APIs are required:
- `cart-provider.tsx`, `cart-button.tsx`, `cart-sheet.tsx` (cart state + UI)
- `app/products/[param]/product-purchase.tsx` (stock polling, qty, add-to-cart)
- `app/search/search-form.tsx` (input state + URL sync)

Everything else (`Header`, `Footer`, `ProductCard`, `ProductGrid`, `PromoBanner`, `CategoryShowcase`, `RelatedProducts`, every page) is a Server Component.

### Configuration quirks

- `next.config.mjs` keeps `typescript.ignoreBuildErrors: true` and `images.unoptimized: true`. `images.remotePatterns` is whitelisted for `**.public.blob.vercel-storage.com` and `**.vercel-storage.com` (where API product images live); add hostnames here if the API ever returns images from a new domain.
- `@vercel/analytics` only mounts when `NODE_ENV === 'production'` (see `app/layout.tsx`).
- The repo is linked to v0 (`https://v0.app/chat/projects/prj_X7UGePkFlLC33RuxWiTZySFDcSzO`); merges to `main` auto-deploy via Vercel. v0 may push commits directly. When deploying, set `VERCEL_PROTECTION_BYPASS_SECRET` in the Vercel project's environment variables.
- The root layout is intentionally synchronous so it doesn't opt routes out of static. `pnpm build` should report `/` as `○` (Static), `/products/[param]` as `●` (SSG), and `/search` as `ƒ` (Dynamic). If you ever convert the layout to `async function` and `await` something that uses `cookies()`/`headers()`/`searchParams`, you will silently switch every route back to dynamic — verify the build output after layout changes.

### Agent layer (shopping agent)

- `lib/gateway.ts` — model resolution. `resolveAgentModel()` returns the **Gateway model id as a string** (auth handled by `@ai-sdk/gateway`: `AI_GATEWAY_API_KEY` → project OIDC token automatically; on Vercel it's automatic, locally `vercel env pull` writes `VERCEL_OIDC_TOKEN`, which the CLI refreshes), or a `LocalWorkflowModel` when `LOCAL_LLM_BASE_URL` is set (Ollama/LM Studio dev escape hatch). Keeping the model a string is required for Vercel Workflows: a raw provider instance carries closure functions (`url`, `headers`) that the durable-step serializer drops (`this.config.url is not a function`), so `LocalWorkflowModel` stores plain data and reconstructs the provider via the SDK's documented `@workflow/serde` custom-class serialization.
- Version lockstep: `ai`, `@ai-sdk/react`, `@ai-sdk/gateway`, `@ai-sdk/openai-compatible`, `@ai-sdk/workflow` must share one release train (currently ai 7.0.173 / react 4.0.177 / gateway 4.0.146 / openai-compatible 3.0.92 / @ai-sdk/workflow 2.0.105, all on `@ai-sdk/provider@4.0.38`). Mismatches install duplicate `@ai-sdk/provider` copies and break `tsc`.
- `lib/agent.ts` — `createShoppingWorkflowAgent()` returns a `WorkflowAgent` (`@ai-sdk/workflow` — AI SDK 7's durable agent, replacement for the old `DurableAgent`/`@workflow/ai` which peers on ai v6); exports `ShoppingUIMessage` (`InferWorkflowAgentUIMessage`) typed for client + server.
- `lib/tools.ts` — `shoppingTools`: `searchProducts`, `getAllCategories`, `getProductDetails`, `returnOrder` (zod-validated; each `execute` starts with `"use step"` so tool calls are durable steps; `returnOrder` validates, then `start()`s the `returnFlow` child workflow and returns `{ runId, message }` immediately).
- `lib/workflows/chat-flow.ts` — `"use workflow"` orchestrator: converts UI messages, creates the `WorkflowAgent`, `stream()`s into `getWritable<ModelCallStreamPart>()`, `stopWhen: isStepCount(10)`.
- `lib/workflows/return-flow.ts` — `"use workflow"` return flow with **one `"use step"` per side effect** (`getOrderStep`, `notifyReturnInProcessStep`, `preauthorizeRefundStep`, `createReturnStep`) so retries replay from cache and never repeat notification/refund; order ending in `01` is the fail-prone test order.
- `app/api/chat/route.ts` — validates with `safeValidateUIMessages`, `start(chatFlow, [messages])`, pipes `run.readable` through `createModelCallToUIChunkTransform()`, returns `x-workflow-run-id` header.
- `app/api/chat/[id]/stream/route.ts` — `GET` re-attaches: `getRun(id)` + replay from raw index 0 with `createModelCallToUIChunkTransform({ uiStartIndex })` + `x-workflow-stream-tail-index` header.
- `components/agent-chat.tsx` — client island: `useChat<ShoppingUIMessage>` + `WorkflowChatTransport` (`@ai-sdk/workflow/client`) with `resume`; stores the run id in localStorage (`` active-workflow-run-id ``), clears on `onChatEnd`, reconnects through `/api/chat/{runId}/stream`.
- `components/agent-tool-parts.tsx` — generative UI per tool part (`AgentToolPart` dispatcher): product grid (reuses `ProductCard`), product detail card with stock badge, category chips, return-received confirmation card; pending/error states for each.
- Default model `anthropic/claude-haiku-5.5`, override with `AGENT_MODEL` (local: `LOCAL_LLM_MODEL`).

### Agent layer (store admin agent)

- `lib/admin-tools.ts` — admin tool surface (`adminTools`): `getSupportTickets`, `getReturnsHistory`, `getInventoryStock`, `getSalesAnalytics` (back-office reads via `lib/api.ts` `getBackOffice*` helpers), catalog `searchProducts`/`getAllCategories` (re-exported from `lib/tools.ts`), and `bash` — executes `bash -lc` in the **persistent Vercel Sandbox**. Every `execute` is `"use step"`; errors return honest `{error}` values.
- `lib/sandbox.ts` — `SANDBOX_NAME` (`swag-store-backoffice`) + `createOrGetSandbox()` (`Sandbox.getOrCreate` from `@vercel/sandbox@4`; memoized per process, idempotent on the API side) + `readMemories()` (reads `memories.md` from the sandbox). The SDK authenticates via the project OIDC token (works locally with `vercel env pull`) and resolves team/project from `.vercel/project.json`. Despite pulling in node builtins, it bundles fine inside the workflow — same trick as the gateway string model.
- `lib/admin-agent.ts` — `createAdminWorkflowAgent(memories)` returns a `WorkflowAgent` with back-office instructions + the docs' **memory protocol** (append `memories.md` via bash; save reusable `scripts/<name>.py`); exports `AdminUIMessage`.
- `lib/workflows/admin-chat-flow.ts` — `"use workflow"` durable admin loop; loads memory at run start and injects it into the agent instructions (so prior context shapes the first turn); `stopWhen: isStepCount(10)`.
- `app/api/admin/chat/route.ts` + `[id]/stream/route.ts` — admin-only (proxy only guards `/admin/:path*`, so both routes check the `admin_auth` cookie themselves → 401), same `start`/transform/resume mechanics as the shopping chat.
- `components/admin-agent-chat.tsx` — client: `WorkflowChatTransport` at `/api/admin/chat`, localStorage `admin-active-workflow-run-id` for refresh recovery, suggestions for back-office tasks; `components/admin-tool-parts.tsx` renders bash (running → exit code + stdout/stderr, failure state), tickets/returns/stock/sales tables, catalog grid.
- Admin gate: login at `/admin/login` (`lib/admin-actions.ts`), cookie path `/admin`, demo-grade password `letmeinadminagent` in `lib/admin-auth.ts` (demo only — replace with opaque/signed tokens for real auth).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
