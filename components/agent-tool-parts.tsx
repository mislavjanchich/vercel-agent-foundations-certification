"use client";

import type { ShoppingUIMessage } from "@/lib/agent";
import { formatPrice } from "@/lib/format";
import type { StockInfo } from "@/lib/types";
import {
  CatalogCategoriesView,
  CatalogSearchView,
  ToolError,
} from "@/components/tool-parts";
import {
  CheckCircle2Icon,
  PackageSearchIcon,
  RotateCcwIcon,
} from "lucide-react";
import Link from "next/link";

type UIMessagePart = ShoppingUIMessage["parts"][number];

type GetProductDetailsPart = Extract<UIMessagePart, { type: "tool-getProductDetails" }>;
type ReturnOrderPart = Extract<UIMessagePart, { type: "tool-returnOrder" }>;

/**
 * Renders the generative UI for any tool part of the shopping agent.
 * Non-tool parts (text, step-start, …) render nothing — the chat handles those.
 * Catalog tools (searchProducts, getAllCategories) reuse the shared views in
 * `components/tool-parts.tsx` — the admin agent uses the same tool
 * definitions, so the UI is shared too.
 */
export function AgentToolPart({ part }: { part: UIMessagePart }) {
  switch (part.type) {
    case "tool-searchProducts":
      return <CatalogSearchView part={part} />;
    case "tool-getProductDetails":
      return <ProductDetailsPart part={part} />;
    case "tool-getAllCategories":
      return <CatalogCategoriesView part={part} />;
    case "tool-returnOrder":
      return <ReturnOrderPart part={part} />;
    default:
      return null;
  }
}

function StockBadge({ stock }: { stock: StockInfo | null }) {
  if (!stock) return null;
  if (!stock.inStock) {
    return (
      <span className="inline-flex w-fit items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
        Out of stock
      </span>
    );
  }
  if (stock.lowStock) {
    return (
      <span className="inline-flex w-fit items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
        Only {stock.stock} left
      </span>
    );
  }
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
      In stock
    </span>
  );
}

function ProductDetailsPart({ part }: { part: GetProductDetailsPart }) {
  if (part.state === "output-error") return <ToolError message={part.errorText} />;
  if (part.state !== "output-available") {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-background/50 px-3 py-2 text-xs text-muted-foreground">
        <PackageSearchIcon className="size-3.5 animate-pulse" />
        Fetching product details…
      </div>
    );
  }

  const product = part.output;
  const image = product.images[0];

  return (
    <div className="w-full overflow-hidden rounded-lg border bg-background/50">
      <div className="flex gap-3 p-3">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.name}
            className="size-24 shrink-0 rounded-md object-cover"
          />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium text-foreground">{product.name}</span>
          <span className="text-sm text-muted-foreground">
            {formatPrice(product.price, product.currency)}
          </span>
          <StockBadge stock={product.stock} />
          <p className="line-clamp-3 text-xs text-muted-foreground">
            {product.description}
          </p>
          <Link
            href={`/products/${product.id}`}
            className="mt-1 w-fit text-xs font-medium text-foreground underline underline-offset-4 hover:opacity-80"
          >
            View product →
          </Link>
        </div>
      </div>
    </div>
  );
}

function ReturnOrderPart({ part }: { part: ReturnOrderPart }) {
  if (part.state === "output-error") return <ToolError message={part.errorText} />;
  if (part.state !== "output-available") {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-background/50 px-3 py-2 text-xs text-muted-foreground">
        <RotateCcwIcon className="size-3.5 animate-pulse" />
        Filing your return…
      </div>
    );
  }

  const output = part.output satisfies {
    runId: string;
    orderId: string;
    message: string;
  };

  return (
    <div className="w-full rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <CheckCircle2Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
        Return request received
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{output.message}</p>
      <dl className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
        <div className="flex justify-between gap-2">
          <dt>Order</dt>
          <dd className="font-mono">{output.orderId}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Request id</dt>
          <dd className="font-mono">{output.runId}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Status</dt>
          <dd>Processing in the background — you&apos;ll be notified when it completes.</dd>
        </div>
      </dl>
    </div>
  );
}
