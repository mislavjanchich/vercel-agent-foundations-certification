"use client";

import { ProductCard } from "@/components/product-card";
import type { Category, Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  AlertCircleIcon,
  PackageSearchIcon,
  ShapesIcon,
} from "lucide-react";

/**
 * Shared generative-UI primitives for agent tool parts.
 *
 * Both agents (shopping + admin) render tool invocations with the same
 * shell: a pending/failure state row, an error box for `output-error`
 * parts, a titled panel for tabular output, and the catalog views (product
 * grid + category chips) that both agents expose via the same tools.
 *
 * The catalog view props are deliberately structural (`state`/`errorText`/
 * `output`) instead of the generated part types, so the same components
 * render parts produced by either agent's tools (they are literally the
 * same tool definitions).
 */

export interface ToolPartLike<TOutput> {
  state: string;
  errorText?: string;
  output?: TOutput;
}

export function ToolStateShell({
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

export function ToolError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" />
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">Something went wrong</span>
        <span className="opacity-80">{message}</span>
      </div>
    </div>
  );
}

/** Titled container with a count badge, used for tabular tool output. */
export function Panel({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full overflow-hidden rounded-lg border bg-background/50">
      <div className="flex items-center justify-between border-b px-3 py-2 text-xs font-medium text-muted-foreground">
        <span>{title}</span>
        {typeof count === "number" && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">
            {count}
          </span>
        )}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function CatalogSearchView({ part }: { part: ToolPartLike<Product[]> }) {
  if (part.state === "output-error") {
    return <ToolError message={part.errorText ?? "Search failed"} />;
  }
  if (part.state !== "output-available") {
    return (
      <ToolStateShell
        icon={<PackageSearchIcon className="size-3.5" />}
        label="Searching the catalog…"
        pending
      />
    );
  }

  const products = part.output ?? [];
  if (products.length === 0) {
    return (
      <ToolStateShell
        icon={<PackageSearchIcon className="size-3.5" />}
        label="No products matched."
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

export function CatalogCategoriesView({
  part,
}: {
  part: ToolPartLike<Category[]>;
}) {
  if (part.state === "output-error") {
    return <ToolError message={part.errorText ?? "Failed to load categories"} />;
  }
  if (part.state !== "output-available") {
    return (
      <ToolStateShell
        icon={<ShapesIcon className="size-3.5" />}
        label="Loading categories…"
        pending
      />
    );
  }

  const categories = part.output ?? [];
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((category) => (
        <span
          key={category.slug}
          className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground"
        >
          {category.name} · {category.productCount}
        </span>
      ))}
    </div>
  );
}
