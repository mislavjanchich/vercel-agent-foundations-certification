"use client";

import type { ShoppingUIMessage } from "@/lib/agent";
import { ProductCard } from "@/components/product-card";
import { formatPrice } from "@/lib/format";
import type { Category, Order, RefundPreauthorization, Return, StockInfo } from "@/lib/types";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  PackageSearchIcon,
  RotateCcwIcon,
  ShapesIcon,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type UIMessagePart = ShoppingUIMessage["parts"][number];

type SearchProductsPart = Extract<UIMessagePart, { type: "tool-searchProducts" }>;
type GetProductDetailsPart = Extract<UIMessagePart, { type: "tool-getProductDetails" }>;
type GetAllCategoriesPart = Extract<UIMessagePart, { type: "tool-getAllCategories" }>;
type ReturnOrderPart = Extract<UIMessagePart, { type: "tool-returnOrder" }>;

/**
 * Renders the generative UI for any tool part of the shopping agent.
 * Non-tool parts (text, step-start, …) render nothing — the chat handles those.
 */
export function AgentToolPart({ part }: { part: UIMessagePart }) {
  switch (part.type) {
    case "tool-searchProducts":
      return <SearchProductsPart part={part} />;
    case "tool-getProductDetails":
      return <ProductDetailsPart part={part} />;
    case "tool-getAllCategories":
      return <CategoriesPart part={part} />;
    case "tool-returnOrder":
      return <ReturnOrderPart part={part} />;
    default:
      return null;
  }
}

function ToolStateShell({
  icon,
  label,
  pending,
}: {
  icon: React.ReactNode;
  label: string;
  pending: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-background/50 px-3 py-2 text-xs text-muted-foreground">
      <span className={cn("text-muted-foreground", pending && "animate-pulse")}>
        {icon}
      </span>
      <span>{label}</span>
    </div>
  );
}

function ToolError({ errorText }: { errorText: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" />
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">Something went wrong</span>
        <span className="opacity-80">{errorText}</span>
      </div>
    </div>
  );
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

function SearchProductsPart({ part }: { part: SearchProductsPart }) {
  if (part.state === "output-error") return <ToolError errorText={part.errorText} />;
  if (part.state !== "output-available") {
    return (
      <ToolStateShell
        icon={<PackageSearchIcon className="size-3.5" />}
        label="Searching the catalog…"
        pending
      />
    );
  }

  const products = part.output;
  if (products.length === 0) {
    return (
      <ToolStateShell
        icon={<PackageSearchIcon className="size-3.5" />}
        label="No products matched that search."
        pending={false}
      />
    );
  }

  return (
    <div className="grid w-full grid-cols-2 gap-2">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

function ProductDetailsPart({ part }: { part: GetProductDetailsPart }) {
  if (part.state === "output-error") return <ToolError errorText={part.errorText} />;
  if (part.state !== "output-available") {
    return (
      <ToolStateShell
        icon={<PackageSearchIcon className="size-3.5" />}
        label="Fetching product details…"
        pending
      />
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

function CategoriesPart({ part }: { part: GetAllCategoriesPart }) {
  if (part.state === "output-error") return <ToolError errorText={part.errorText} />;
  if (part.state !== "output-available") {
    return (
      <ToolStateShell
        icon={<ShapesIcon className="size-3.5" />}
        label="Loading categories…"
        pending
      />
    );
  }

  const categories: Category[] = part.output;
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((category) => (
        <span
          key={category.slug}
          className="inline-flex items-center gap-1.5 rounded-full border bg-background/50 px-2.5 py-1 text-xs text-muted-foreground"
        >
          {category.name}
          <span className="text-[10px] opacity-60">{category.productCount}</span>
        </span>
      ))}
    </div>
  );
}

function ReturnOrderPart({ part }: { part: ReturnOrderPart }) {
  if (part.state === "output-error") return <ToolError errorText={part.errorText} />;
  if (part.state !== "output-available") {
    return (
      <ToolStateShell
        icon={<RotateCcwIcon className="size-3.5" />}
        label="Filing your return…"
        pending
      />
    );
  }

  const { order, returnRequest, refundPreauthorization } = part.output satisfies {
    order: Order;
    returnRequest: Return;
    refundPreauthorization: RefundPreauthorization;
  };

  return (
    <div className="w-full rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <CheckCircle2Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
        Return filed for order {returnRequest.orderId}
      </div>
      <dl className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
        <div className="flex justify-between gap-2">
          <dt>Status</dt>
          <dd className="font-medium text-foreground capitalize">{returnRequest.status}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Items</dt>
          <dd className="font-mono">
            {returnRequest.items
              .map((item) => `${item.quantity} × ${item.productId}`)
              .join(", ")}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Order total</dt>
          <dd>{formatPrice(order.total, order.currency)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Refund pre-authorized</dt>
          <dd className="font-medium text-foreground">
            {formatPrice(refundPreauthorization.amount, refundPreauthorization.currency)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
