import {
  createReturn,
  getOrder,
  notifyReturnInProcess,
  preauthorizeRefund,
} from "@/lib/api";
import type { Order, Return } from "@/lib/types";

export interface ReturnFlowItem {
  productId: string;
  quantity: number;
}

/**
 * Durable return workflow.
 *
 * `returnFlow` is the durable orchestrator (`"use workflow"`): it survives
 * restarts and exacts exactly-once semantics at the *action* level by giving
 * each side effect its own `"use step"`. A step that completed is cached and
 * replayed, so a failure further down (or a crash mid-run) only re-runs the
 * step that broke — the customer is notified once, the refund is
 * pre-authorized once, and the filing retries on its own.
 *
 * The caller (`returnOrder` in `lib/tools.ts`) starts this with `start()` and
 * returns immediately: the tool answer confirms the request to the shopper
 * while the run continues in the background.
 */
export async function returnFlow(
  orderId: string,
  reason: string,
  items?: ReturnFlowItem[],
) {
  "use workflow";

  const order = await getOrderStep(orderId);
  await notifyReturnInProcessStep(orderId);
  await preauthorizeRefundStep(orderId);
  const filed = await createReturnStep(order, reason, items);

  return { orderId, returnId: filed.id };
}

async function getOrderStep(orderId: string): Promise<Order> {
  "use step";
  return getOrder(orderId);
}

async function notifyReturnInProcessStep(orderId: string): Promise<void> {
  "use step";
  await notifyReturnInProcess(orderId);
}

async function preauthorizeRefundStep(orderId: string): Promise<void> {
  "use step";
  await preauthorizeRefund(orderId);
}

async function createReturnStep(
  order: Order,
  reason: string,
  items?: ReturnFlowItem[],
): Promise<Return> {
  "use step";
  return createReturn({
    orderId: order.id,
    items:
      items ??
      order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    reason,
  });
}
