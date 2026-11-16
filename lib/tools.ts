import { tool } from "ai";
import { z } from "zod";
import {
  getCategories,
  getOrder,
  getProductById,
  getProducts,
  getProductStock,
} from "@/lib/api";
import { returnFlow, type ReturnFlowItem } from "@/lib/workflows/return-flow";
import { start } from "workflow/api";

/**
 * Tools for the storefront shopping agent.
 *
 * All of them wrap the (server-only) Swag Store API helpers in `lib/api.ts`:
 *  - inputs are validated with zod before `execute` runs,
 *  - every tool result must be JSON-serializable (it is streamed to the UI
 *    and fed back to the model),
 *  - failures throw; the AI SDK surfaces them to the model as tool errors so
 *    the agent can answer honestly instead of hallucinating a result.
 *
 * Each `execute` is marked `"use step"` so that, inside the durable chat
 * workflow (`lib/workflows/chat-flow.ts`), the tool call runs as its own
 * retryable, cached workflow step. `returnOrder` additionally starts the
 * background `returnFlow` child workflow and returns immediately, so the
 * shopper's request is confirmed without blocking the agent on slow or
 * fail-prone store calls.
 */
export const shoppingTools = {
  searchProducts: tool({
    description:
      "Search the Ship It Shop catalog for products. Use this whenever a shopper is looking for products, gift ideas, or items in a category.",
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .max(200)
        .optional()
        .describe("Free-text search term, e.g. 'hoodie'"),
      category: z
        .string()
        .min(1)
        .optional()
        .describe("Category slug to filter by (see getAllCategories)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe("How many products to return (default 8)"),
    }),
    execute: async ({ query, category, limit }) => {
      "use step";
      return getProducts({
        search: query,
        category,
        limit: limit ?? 8,
      });
    },
  }),

  getAllCategories: tool({
    description:
      "List every product category in the store with its slug and product count. Use when a shopper wants to browse, or to look up valid category slugs before calling searchProducts.",
    inputSchema: z.object({}),
    execute: async () => {
      "use step";
      return getCategories();
    },
  }),

  getProductDetails: tool({
    description:
      "Get full details for one product — description, price, images, and live stock — by its id or slug. Use after searchProducts when the shopper asks about a specific item.",
    inputSchema: z.object({
      idOrSlug: z
        .string()
        .min(1)
        .describe("Product id or slug, e.g. 'bottle_001'"),
      includeStock: z
        .boolean()
        .optional()
        .describe("Include live stock information (default true)"),
    }),
    execute: async ({ idOrSlug, includeStock = true }) => {
      "use step";
      const product = await getProductById(idOrSlug);
      if (!includeStock) return { ...product, stock: null };
      // Stock is best-effort: a stock outage shouldn't hide the product.
      const stock = await getProductStock(idOrSlug).catch(() => null);
      return { ...product, stock };
    },
  }),

  returnOrder: tool({
    description:
      "File a return for a shopper's order. Validates the order, starts a durable background return workflow (notify → pre-authorize refund → file), and confirms the request immediately. Ask for the order id and reason if the shopper hasn't given them. Example order ids: 11111, 22222, 33333.",
    inputSchema: z.object({
      orderId: z.string().min(1).describe("The order id, e.g. '11111'"),
      reason: z
        .string()
        .min(1)
        .max(1000)
        .describe("Why the shopper is returning the items"),
      items: z
        .array(
          z.object({
            productId: z.string().min(1).describe("Product id from the order"),
            quantity: z.number().int().min(1),
          }),
        )
        .min(1)
        .optional()
        .describe("Items to return; omit to return every item in the order"),
    }),
    execute: async ({ orderId, reason, items }) => {
      "use step";
      // Fetch and validate before starting the workflow, so the model can
      // correct itself instead of surfacing an API error mid-run.
      const order = await getOrder(orderId);

      const returnItems: ReturnFlowItem[] =
        items ??
        order.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        }));

      for (const item of returnItems) {
        const ordered = order.items.find(
          (candidate) => candidate.productId === item.productId,
        );
        if (!ordered) {
          throw new Error(
            `Product ${item.productId} is not part of order ${orderId}. The order contains: ${order.items
              .map((candidate) => candidate.productId)
              .join(", ")}.`,
          );
        }
        if (item.quantity > ordered.quantity) {
          throw new Error(
            `Cannot return ${item.quantity} of ${item.productId}: only ${ordered.quantity} were ordered.`,
          );
        }
      }

      // Fire-and-forget: start() returns the run id immediately and the
      // return continues in the background.
      const run = await start(returnFlow, [
        orderId,
        reason,
        returnItems,
      ]);

      return {
        runId: run.runId,
        orderId,
        message: `Return request received for order ${orderId}. We've started processing it and will keep you updated.`,
      };
    },
  }),
};
