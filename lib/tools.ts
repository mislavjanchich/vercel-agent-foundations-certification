import { tool } from "ai";
import { z } from "zod";
import {
  createReturn,
  getCategories,
  getOrder,
  getProductById,
  getProducts,
  getProductStock,
  notifyReturnInProcess,
  preauthorizeRefund,
} from "@/lib/api";

/**
 * Tools for the storefront shopping agent.
 *
 * All of them wrap the (server-only) Swag Store API helpers in `lib/api.ts`:
 *  - inputs are validated with zod before `execute` runs,
 *  - every tool result must be JSON-serializable (it is streamed to the UI
 *    and fed back to the model),
 *  - failures throw; the AI SDK surfaces them to the model as tool errors so
 *    the agent can answer honestly instead of hallucinating a result.
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
    execute: async ({ query, category, limit }) =>
      getProducts({
        search: query,
        category,
        limit: limit ?? 8,
      }),
  }),

  getAllCategories: tool({
    description:
      "List every product category in the store with its slug and product count. Use when a shopper wants to browse, or to look up valid category slugs before calling searchProducts.",
    inputSchema: z.object({}),
    execute: async () => getCategories(),
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
      const product = await getProductById(idOrSlug);
      if (!includeStock) return { ...product, stock: null };
      // Stock is best-effort: a stock outage shouldn't hide the product.
      const stock = await getProductStock(idOrSlug).catch(() => null);
      return { ...product, stock };
    },
  }),

  returnOrder: tool({
    description:
      "File a return for a shopper's order. Validates the items against the order, creates the return, notifies the shopper that it is being processed, and pre-authorizes the refund. Confirm the order id, which items, and the reason with the shopper before calling this.",
    inputSchema: z.object({
      orderId: z.string().min(1).describe("The order id, e.g. 'ord_123'"),
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
      const order = await getOrder(orderId);

      const returnItems =
        items ??
        order.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        }));

      // Validate requested items against the order before creating anything,
      // so the model can correct itself instead of surfacing an API 400.
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

      const createdReturn = await createReturn({
        orderId,
        items: returnItems,
        reason,
      });
      await notifyReturnInProcess(orderId);
      const refundPreauthorization = await preauthorizeRefund(orderId);

      return { order, returnRequest: createdReturn, refundPreauthorization };
    },
  }),
};
