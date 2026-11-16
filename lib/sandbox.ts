import { Sandbox } from "@vercel/sandbox";

/**
 * Persistent Vercel Sandbox for the admin agent.
 *
 * A single named sandbox is shared across the store admin's chats, so files
 * written by one conversation (memories.md, reusable scripts) are visible to
 * the next one. `Sandbox.getOrCreate` resumes the named sandbox if it exists
 * and creates it on first use.
 *
 * The `@vercel/sandbox` SDK authenticates via the project OIDC token
 * (automatic on Vercel; locally `vercel env pull` writes `VERCEL_OIDC_TOKEN`)
 * or the Vercel CLI auth file, and resolves the team/project from
 * `.vercel/project.json` (created by `vercel link`).
 */
export const SANDBOX_NAME = "swag-store-backoffice";

let sandboxPromise: Promise<Sandbox> | null = null;

/**
 * Returns the named persistent sandbox, creating it on first call.
 * Memoized per process; `Sandbox.getOrCreate` is idempotent anyway.
 */
export function createOrGetSandbox(
  name: string = SANDBOX_NAME,
): Promise<Sandbox> {
  if (!sandboxPromise) {
    sandboxPromise = Sandbox.getOrCreate({ name }).catch((error) => {
      sandboxPromise = null;
      throw error;
    });
  }
  return sandboxPromise;
}

/**
 * Reads the admin agent's persistent memory. Returns `null` when the file
 * hasn't been created yet (first conversation).
 */
export async function readMemories(): Promise<string | null> {
  const sandbox = await createOrGetSandbox();
  const buffer = await sandbox.readFileToBuffer({ path: "memories.md" });
  if (!buffer) return null;
  return new TextDecoder().decode(buffer);
}
