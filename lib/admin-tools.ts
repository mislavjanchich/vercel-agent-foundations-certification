import { tool } from "ai";
import { z } from "zod";
import {
  ApiRequestError,
  getBackOfficeReturns,
  getBackOfficeSales,
  getBackOfficeStock,
  getBackOfficeSupportTickets,
} from "@/lib/api";
import { getAllCategories, searchProducts } from "@/lib/tools";
import { createOrGetSandbox } from "@/lib/sandbox";

/**
 * Tools for the store **admin agent** (`/admin`).
 *
 * Read-only back-office data (returns, inventory, sales, support tickets)
 * plus read-only catalog search, plus one `bash` tool that executes inside a
 * persistent Vercel Sandbox so the agent can compute with real data (write
 * fetched JSON to /tmp, run python3) without ever mutating the store.
 *
 * Everything is wrapped in `"use step"` so each tool call is a durable,
 * retried workflow step; errors are returned to the model as honest `{error}`
 * values instead of raw thrown exceptions.
 */

function errorMessage(err: unknown): string {
  return err instanceof ApiRequestError ? err.message : "Unknown error";
}

export const getSupportTickets = tool({
  description: `List support tickets from the back office within a date range. Each ticket includes status, priority, category, assignee (staff username or null when unassigned), the related customer/order, and timestamps. Use this for triaging the support queue, spotting spikes in a category, checking workload by assignee, or auditing unresolved urgent tickets. History covers ~last 180 days. Summarize across the rows in your reply rather than dumping them; for more than ~10 rows of arithmetic, note that exact joins and aggregates are limited until a sandbox tool is added.`,
  inputSchema: z.object({
    from: z
      .string()
      .optional()
      .describe(
        `ISO 8601 datetime or YYYY-MM-DD. Defaults to 30 days before "to". If the user gives a vague window ("this month", "recently"), pick a sensible range, state it explicitly in your reply, and proceed.`,
      ),
    to: z
      .string()
      .optional()
      .describe(`ISO 8601 datetime or YYYY-MM-DD. Defaults to now.`),
    status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    category: z
      .enum([
        "shipping",
        "returns",
        "product_quality",
        "sizing",
        "billing",
        "payment",
        "account",
        "other",
      ])
      .optional(),
    assignee: z
      .string()
      .optional()
      .describe(
        `Staff username (e.g. "alex"). When set, unassigned tickets are excluded.`,
      ),
    limit: z.number().int().min(1).max(500).optional(),
  }),
  execute: async ({
    from,
    to,
    status,
    priority,
    category,
    assignee,
    limit,
  }) => {
    "use step";
    try {
      const { data, meta } = await getBackOfficeSupportTickets({
        from,
        to,
        status,
        priority,
        category,
        assignee,
        limit,
      });
      return { count: data.length, tickets: data, range: meta };
    } catch (err) {
      return { count: 0, tickets: [], error: errorMessage(err) };
    }
  },
});

export const getReturnsHistory = tool({
  description: `List historical returns from the back office within a date range. Each entry includes the items returned, the decision (approved/rejected/needs_info), refund amount in cents (divide by 100 for dollar amounts in your reply), and a summary of the related order. Use this for return triage, refund auditing, or identifying products with high return volumes. History covers ~last 180 days. Summarize across the returned rows in your reply rather than dumping them; for more than ~10 rows of arithmetic, note that exact joins and aggregates are limited until a sandbox tool is added.`,
  inputSchema: z.object({
    from: z
      .string()
      .optional()
      .describe(
        `ISO 8601 datetime or YYYY-MM-DD. Defaults to 30 days before "to". If the user gives a vague window ("this month", "recently"), pick a sensible range, state it explicitly in your reply, and proceed.`,
      ),
    to: z
      .string()
      .optional()
      .describe(`ISO 8601 datetime or YYYY-MM-DD. Defaults to now.`),
    status: z.enum(["pending", "processing", "completed"]).optional(),
    decision: z.enum(["approved", "rejected", "needs_info"]).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  }),
  execute: async ({ from, to, status, decision, limit }) => {
    "use step";
    try {
      const { data, meta } = await getBackOfficeReturns({
        from,
        to,
        status,
        decision,
        limit,
      });
      return { count: data.length, returns: data, range: meta };
    } catch (err) {
      return { count: 0, returns: [], error: errorMessage(err) };
    }
  },
});

export const getInventoryStock = tool({
  description: `Current stock levels for all products (or a subset). Results are sorted by stock ascending, so out-of-stock and low-stock items appear first. Use this to answer questions about availability, restocking priorities, or which items are about to run out. Summarize the rows in your reply rather than dumping them.`,
  inputSchema: z.object({
    productIds: z
      .array(z.string())
      .optional()
      .describe(`Restrict the query to specific product ids.`),
    lowStock: z
      .boolean()
      .optional()
      .describe(
        `true = only items with 1–5 units in stock; false = exclude low-stock items.`,
      ),
    inStock: z
      .boolean()
      .optional()
      .describe(`true = only items with at least one unit; false = only zero.`),
    page: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  execute: async ({ productIds, lowStock, inStock, page, limit }) => {
    "use step";
    try {
      const { data, meta } = await getBackOfficeStock({
        productIds,
        lowStock,
        inStock,
        page,
        limit,
      });
      return { count: data.length, stock: data, pagination: meta.pagination };
    } catch (err) {
      return { count: 0, stock: [], error: errorMessage(err) };
    }
  },
});

export const getSalesAnalytics = tool({
  description: `Sales totals by product within a date range. Each row reports unitsSold, ordersCount, and revenue in cents (divide by 100 for dollar amounts in your reply). Results are sorted by unitsSold descending. Pair with getReturnsHistory to compute per-product return rates. Sales data covers ~last 180 days. Summarize across the rows in your reply rather than dumping them; for more than ~10 rows of arithmetic, note that exact joins and aggregates are limited until a sandbox tool is added.`,
  inputSchema: z.object({
    from: z
      .string()
      .optional()
      .describe(
        `ISO 8601 datetime or YYYY-MM-DD. Defaults to 30 days before "to". If the user gives a vague window ("this month", "recently"), pick a sensible range, state it explicitly in your reply, and proceed.`,
      ),
    to: z
      .string()
      .optional()
      .describe(`ISO 8601 datetime or YYYY-MM-DD. Defaults to now.`),
    productId: z
      .string()
      .optional()
      .describe(`Restrict to a single product. 404s if it doesn't exist.`),
  }),
  execute: async ({ from, to, productId }) => {
    "use step";
    try {
      const { data, meta } = await getBackOfficeSales({ from, to, productId });
      return { count: data.length, sales: data, summary: meta };
    } catch (err) {
      return { count: 0, sales: [], error: errorMessage(err) };
    }
  },
});

export const bash = tool({
  description: `Run a bash command in the sandbox environment`,
  inputSchema: z.object({
    command: z.string().describe("The bash command to run"),
  }),
  execute: async ({ command }) => {
    "use step";
    const sandbox = await createOrGetSandbox();
    const result = await sandbox.runCommand("bash", ["-lc", command]);
    return {
      stdout: await result.stdout(),
      stderr: await result.stderr(),
      exitCode: result.exitCode,
    };
  },
});

/** The full tool surface for the admin agent. */
export const adminTools = {
  searchProducts,
  getAllCategories,
  getSupportTickets,
  getReturnsHistory,
  getInventoryStock,
  getSalesAnalytics,
  bash,
};
