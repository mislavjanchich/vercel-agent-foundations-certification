import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  WORKFLOW_DESERIALIZE,
  WORKFLOW_SERIALIZE,
} from "@workflow/serde";
import type { LanguageModel } from "ai";
import { registerSerializationClass } from "workflow/internal/class-serialization";

/**
 * Model access for the store agents.
 *
 * Two paths, resolved where the agent is created:
 *
 * 1. **Vercel AI Gateway (default, also production)** — returns the Gateway
 *    *model id* as a string. `WorkflowAgent` resolves it through the
 *    `@ai-sdk/gateway` provider, which authenticates automatically:
 *    `apiKey` setting → `AI_GATEWAY_API_KEY` env → project OIDC token
 *    (`getVercelOidcToken()`, automatic on Vercel deployments; locally
 *    `vercel env pull` writes `VERCEL_OIDC_TOKEN`). Keeping this a string
 *    (instead of a provider instance with an explicit token) matters for
 *    Vercel Workflows: it keeps Node-only code (`@vercel/oidc`/`jose`) out
 *    of the `"use workflow"` orchestrator bundle.
 *
 * 2. **Local model (opt-in, dev only)** — set `LOCAL_LLM_BASE_URL` (e.g.
 *    `http://localhost:11434/v1` for Ollama) and a small serializable
 *    wrapper around an OpenAI-compatible model is returned. Useful when the
 *    AI Gateway has no billing on file yet. NEVER set this in the Vercel
 *    project environment.
 *
 * The wrapper exists because durable workflow steps serialize their
 * arguments: a raw provider instance carries closure functions (`url`,
 * `headers`) that plain serialization drops, which breaks the model call
 * after replay ("this.config.url is not a function"). `LocalWorkflowModel`
 * stores only plain data and reconstructs the provider on demand, using the
 * Workflow SDK's documented custom-class serialization (`@workflow/serde`).
 *
 * `@ai-sdk/openai-compatible` is pinned to 3.0.92 on purpose: versions
 * above it depend on newer `@ai-sdk/provider` releases than the installed
 * `ai`, and pnpm then installs two incompatible copies of the provider spec,
 * which breaks `tsc` with duplicate-`LanguageModelV4` assignability errors.
 * Keep openai-compatible, gateway, and ai on the same release train.
 */

interface LocalModelRef {
  baseURL: string;
  apiKey: string;
  modelId: string;
}

/** The V4 language-model object arm of the `LanguageModel` union. */
type AgentLanguageModelV4 = Extract<LanguageModel, { specificationVersion: "v4" }>;

function createLocalModel(ref: LocalModelRef): AgentLanguageModelV4 {
  const provider = createOpenAICompatible({
    name: "local-openai-compatible",
    baseURL: ref.baseURL,
    apiKey: ref.apiKey,
  });
  return provider(ref.modelId);
}

/**
 * Serializable LanguageModel wrapper for a local OpenAI-compatible server.
 * See the module comment for why this exists.
 */
class LocalWorkflowModel implements AgentLanguageModelV4 {
  static classId = "class//ship-it-shop//local-workflow-model";

  readonly specificationVersion = "v4" as const;
  readonly provider: string;
  readonly modelId: string;
  readonly supportedUrls: AgentLanguageModelV4["supportedUrls"];

  constructor(private readonly ref: LocalModelRef) {
    const inner = createLocalModel(ref);
    this.provider = inner.provider;
    this.modelId = inner.modelId;
    this.supportedUrls = inner.supportedUrls;
  }

  doGenerate(options: Parameters<AgentLanguageModelV4["doGenerate"]>[0]) {
    return createLocalModel(this.ref).doGenerate(options);
  }

  doStream(options: Parameters<AgentLanguageModelV4["doStream"]>[0]) {
    return createLocalModel(this.ref).doStream(options);
  }

  static [WORKFLOW_SERIALIZE](instance: LocalWorkflowModel): LocalModelRef {
    return instance.ref;
  }

  static [WORKFLOW_DESERIALIZE](ref: LocalModelRef): LocalWorkflowModel {
    return new LocalWorkflowModel(ref);
  }
}

registerSerializationClass(LocalWorkflowModel.classId, LocalWorkflowModel);

/**
 * Returns the model reference for the agents: a Gateway model id string by
 * default, or a `LocalWorkflowModel` when `LOCAL_LLM_BASE_URL` is set.
 */
export function resolveAgentModel(): LanguageModel | string {
  const localBaseUrl = process.env.LOCAL_LLM_BASE_URL;
  if (localBaseUrl) {
    return new LocalWorkflowModel({
      baseURL: localBaseUrl,
      apiKey: process.env.LOCAL_LLM_API_KEY ?? "local",
      modelId:
        process.env.LOCAL_LLM_MODEL ??
        process.env.AGENT_MODEL ??
        "lfm2.5:latest",
    });
  }

  return process.env.AGENT_MODEL ?? "anthropic/claude-haiku-5.5";
}
