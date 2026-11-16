import { createGateway } from "@ai-sdk/gateway";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getVercelOidcToken } from "@vercel/oidc";
import type { LanguageModel } from "ai";

/**
 * Model access for the store agents.
 *
 * Two paths:
 *
 * 1. **Vercel AI Gateway (default, also production)** — the official
 *    `@ai-sdk/gateway` provider. Auth: `AI_GATEWAY_API_KEY` first, then the
 *    project OIDC token (`getVercelOidcToken()` from `@vercel/oidc`; on Vercel
 *    this is automatic, and locally `vercel env pull` writes
 *    `VERCEL_OIDC_TOKEN`, which the library refreshes from CLI credentials).
 *    Vercel rotates the OIDC token in under an hour, so credentials and the
 *    model instance are built per request rather than at module scope.
 *
 * 2. **Local model (opt-in, dev only)** — set `LOCAL_LLM_BASE_URL` (e.g.
 *    `http://localhost:11434/v1` for Ollama) and the gateway is bypassed and
 *    the same OpenAI-compatible protocol is used against your local server.
 *    Useful when the AI Gateway has no billing on file yet; never set this in
 *    the Vercel project's environment. Model defaults to `LOCAL_LLM_MODEL`,
 *    then `AGENT_MODEL`, then `lfm2.5:latest`.
 *
 * `@ai-sdk/openai-compatible` is pinned to 3.0.0 on purpose: versions above
 * it depend on newer `@ai-sdk/provider` / `provider-utils` releases than
 * `ai@7.0.2`, and pnpm then installs two incompatible copies of the provider
 * spec, which breaks `tsc` with duplicate-`LanguageModelV4` assignability
 * errors. Keep openai-compatible, gateway, and ai on the same release train.
 */
const DEFAULT_MODEL_ID = "anthropic/claude-haiku-5.5";
const DEFAULT_LOCAL_MODEL_ID = "lfm2.5:latest";

export async function getGatewayApiKey(): Promise<string> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (apiKey) return apiKey;

  try {
    return await getVercelOidcToken();
  } catch (error) {
    throw new Error(
      "No AI Gateway credentials available. Set AI_GATEWAY_API_KEY, or run `vercel env pull .env.local` to obtain a project OIDC token.",
      { cause: error },
    );
  }
}

/**
 * Returns a `LanguageModel` for the shopping/admin agents.
 *
 * With `LOCAL_LLM_BASE_URL` set the local OpenAI-compatible server is used;
 * otherwise the Vercel AI Gateway (via OIDC/API key).
 *
 * @param modelId Model id, e.g. "anthropic/claude-haiku-5.5". Defaults to
 *                `AGENT_MODEL`, then the path default (gateway → haiku-5.5,
 *                local → lfm2.5:latest).
 */
export async function getGatewayModel(
  modelId?: string,
): Promise<LanguageModel> {
  const localBaseUrl = process.env.LOCAL_LLM_BASE_URL;
  if (localBaseUrl) {
    const localProvider = createOpenAICompatible({
      name: "local-openai-compatible",
      baseURL: localBaseUrl,
      apiKey: process.env.LOCAL_LLM_API_KEY ?? "local",
    });
    return localProvider(
      modelId ??
        process.env.LOCAL_LLM_MODEL ??
        process.env.AGENT_MODEL ??
        DEFAULT_LOCAL_MODEL_ID,
    );
  }

  const gateway = createGateway({
    apiKey: await getGatewayApiKey(),
  });
  return gateway.languageModel(
    modelId ?? process.env.AGENT_MODEL ?? DEFAULT_MODEL_ID,
  );
}
