import { createGateway } from "@ai-sdk/gateway";
import { getVercelOidcToken } from "@vercel/oidc";
import type { LanguageModel } from "ai";

/**
 * Vercel AI Gateway access for the store agents.
 *
 * Every model call goes through the AI Gateway via the official
 * `@ai-sdk/gateway` provider:
 *  - Auth priority: `AI_GATEWAY_API_KEY` (works anywhere, e.g. local dev
 *    without a linked project) → project OIDC token (a valid Vercel access
 *    token for the gateway; automatic on Vercel deployments, and locally
 *    `vercel env pull` writes `VERCEL_OIDC_TOKEN`, which `@vercel/oidc`
 *    auto-refreshes from the CLI credentials).
 *  - Vercel rotates the OIDC token in under an hour, so credentials and the
 *    model instance are built per request rather than at module scope.
 */
const DEFAULT_MODEL_ID = "anthropic/claude-haiku-5.5";

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
 * Returns a LanguageModel served through the Vercel AI Gateway.
 * @param modelId Gateway model id, e.g. "anthropic/claude-haiku-5.5".
 *                Defaults to `AGENT_MODEL`, then the store default.
 */
export async function getGatewayModel(
  modelId?: string,
): Promise<LanguageModel> {
  const gateway = createGateway({
    apiKey: await getGatewayApiKey(),
  });
  return gateway.languageModel(
    modelId ?? process.env.AGENT_MODEL ?? DEFAULT_MODEL_ID,
  );
}
