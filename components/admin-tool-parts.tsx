"use client";

import type { AdminUIMessage } from "@/lib/admin-agent";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  ProductSalesRow,
  Return,
  StockEntry,
  SupportTicket,
} from "@/lib/types";
import { ProductCard } from "@/components/product-card";
import {
  AlertCircleIcon,
  BoxesIcon,
  ChartColumnIcon,
  PackageSearchIcon,
  RotateCcwIcon,
  ShapesIcon,
  TerminalIcon,
  TicketIcon,
} from "lucide-react";

type AdminPart = AdminUIMessage["parts"][number];
type BashPart = Extract<AdminPart, { type: "tool-bash" }>;
type TicketsPart = Extract<AdminPart, { type: "tool-getSupportTickets" }>;
type ReturnsPart = Extract<AdminPart, { type: "tool-getReturnsHistory" }>;
type StockPart = Extract<AdminPart, { type: "tool-getInventoryStock" }>;
type SalesPart = Extract<AdminPart, { type: "tool-getSalesAnalytics" }>;
type SearchPart = Extract<AdminPart, { type: "tool-searchProducts" }>;
type CategoriesPart = Extract<AdminPart, { type: "tool-getAllCategories" }>;

/**
 * Renders the generative UI for any admin agent tool part. Non-tool parts
 * (text, step-start, …) render nothing — the chat handles those.
 */
export function AdminToolPart({ part }: { part: AdminPart }) {
  switch (part.type) {
    case "tool-bash":
      return <BashPart part={part} />;
    case "tool-getSupportTickets":
      return <SupportTicketsPart part={part} />;
    case "tool-getReturnsHistory":
      return <ReturnsHistoryPart part={part} />;
    case "tool-getInventoryStock":
      return <InventoryStockPart part={part} />;
    case "tool-getSalesAnalytics":
      return <SalesAnalyticsPart part={part} />;
    case "tool-searchProducts":
      return <CatalogSearchPart part={part} />;
    case "tool-getAllCategories":
      return <CatalogCategoriesPart part={part} />;
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

function ToolError({ message }: { message: string }) {
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

function Panel({
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

/** Bash: terminal-style output with running / success / failure states. */
function BashPart({ part }: { part: BashPart }) {
  if (part.state === "output-error") return <ToolError message={part.errorText} />;

  const command = part.input?.command ?? "";

  if (part.state !== "output-available") {
    return (
      <div className="rounded-md border bg-background/50 px-3 py-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <TerminalIcon className="size-3.5 animate-pulse" />
          <span className="font-medium">Running in sandbox…</span>
        </div>
        {command && (
          <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap rounded bg-foreground/5 p-2 font-mono text-[11px] text-foreground/80">
            $ {command}
          </pre>
        )}
      </div>
    );
  }

  const output = part.output;
  const failed = output.exitCode !== 0;

  return (
    <div className="overflow-hidden rounded-md border bg-background/50">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <TerminalIcon
            className={cn(
              "size-3.5 shrink-0",
              failed ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
            )}
          />
          <pre className="truncate font-mono text-[11px] text-muted-foreground">
            {command || "bash"}
          </pre>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
            failed
              ? "bg-destructive/10 text-destructive"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
          )}
        >
          {failed ? `exit ${output.exitCode}` : "exit 0"}
        </span>
      </div>
      {(output.stdout || output.stderr) && (
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap p-2 font-mono text-[11px] leading-relaxed text-foreground/80">
          {output.stdout}
          {output.stderr && (
            <span className="text-destructive">{output.stderr}</span>
          )}
        </pre>
      )}
      {!output.stdout && !output.stderr && (
        <p className="px-3 py-2 text-[11px] text-muted-foreground">
          (no output)
        </p>
      )}
    </div>
  );
}

function SupportTicketsPart({ part }: { part: TicketsPart }) {
  if (part.state === "output-error") return <ToolError message={part.errorText} />;
  if (part.state !== "output-available") {
    return (
      <ToolStateShell icon={<TicketIcon className="size-3.5" />} label="Loading support tickets…" pending />
    );
  }

  const { tickets, count } = part.output;
  if (!tickets || tickets.length === 0) {
    return (
      <ToolStateShell icon={<TicketIcon className="size-3.5" />} label="No support tickets in that range." pending={false} />
    );
  }

  return (
    <Panel title="Support tickets" count={count}>
      <ul className="divide-y">
        {tickets.slice(0, 10).map((ticket: SupportTicket) => (
          <li key={ticket.id} className="flex flex-col gap-1 px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium text-foreground">
                {ticket.subject}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  ticket.priority === "urgent"
                    ? "bg-destructive/10 text-destructive"
                    : ticket.priority === "high"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "bg-secondary text-muted-foreground",
                )}
              >
                {ticket.priority}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              <span className="capitalize">{ticket.category}</span>
              <span>{ticket.status}</span>
              <span>{ticket.customerEmail}</span>
              {ticket.assignee && <span>→ {ticket.assignee}</span>}
              {ticket.relatedOrderId && (
                <span className="font-mono">{ticket.relatedOrderId}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function ReturnsHistoryPart({ part }: { part: ReturnsPart }) {
  if (part.state === "output-error") return <ToolError message={part.errorText} />;
  if (part.state !== "output-available") {
    return (
      <ToolStateShell icon={<RotateCcwIcon className="size-3.5" />} label="Loading return history…" pending />
    );
  }

  const { returns, count } = part.output;
  if (!returns || returns.length === 0) {
    return (
      <ToolStateShell icon={<RotateCcwIcon className="size-3.5" />} label="No returns in that range." pending={false} />
    );
  }

  return (
    <Panel title="Returns" count={count}>
      <table className="w-full text-left text-xs">
        <thead className="text-[11px] uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-1.5 font-medium">Order</th>
            <th className="px-3 py-1.5 font-medium">Items</th>
            <th className="px-3 py-1.5 font-medium">Decision</th>
            <th className="px-3 py-1.5 font-medium">Refund</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {returns.slice(0, 10).map((ret: Return) => (
            <tr key={ret.id}>
              <td className="px-3 py-1.5 font-mono">{ret.orderId}</td>
              <td className="px-3 py-1.5 text-muted-foreground">
                {ret.items.map((item) => item.productId).join(", ")}
              </td>
              <td className="px-3 py-1.5">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                    ret.decision === "approved"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : ret.decision === "rejected"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-secondary text-muted-foreground",
                  )}
                >
                  {ret.decision ?? "pending"}
                </span>
              </td>
              <td className="px-3 py-1.5 text-muted-foreground">
                {ret.refundAmount != null
                  ? formatPrice(ret.refundAmount, "USD")
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function InventoryStockPart({ part }: { part: StockPart }) {
  if (part.state === "output-error") return <ToolError message={part.errorText} />;
  if (part.state !== "output-available") {
    return (
      <ToolStateShell icon={<BoxesIcon className="size-3.5" />} label="Checking inventory…" pending />
    );
  }

  const { stock, count } = part.output;
  if (!stock || stock.length === 0) {
    return (
      <ToolStateShell icon={<BoxesIcon className="size-3.5" />} label="No stock rows." pending={false} />
    );
  }

  return (
    <Panel title="Inventory" count={count}>
      <table className="w-full text-left text-xs">
        <thead className="text-[11px] uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-1.5 font-medium">Product</th>
            <th className="px-3 py-1.5 font-medium">Stock</th>
            <th className="px-3 py-1.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {stock.slice(0, 10).map((entry: StockEntry) => (
            <tr key={entry.productId}>
              <td className="px-3 py-1.5">
                <div className="font-medium text-foreground">{entry.product.name}</div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {entry.productId}
                </div>
              </td>
              <td className="px-3 py-1.5 font-mono">{entry.stock}</td>
              <td className="px-3 py-1.5">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    !entry.inStock
                      ? "bg-destructive/10 text-destructive"
                      : entry.lowStock
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {!entry.inStock ? "out" : entry.lowStock ? "low" : "ok"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function SalesAnalyticsPart({ part }: { part: SalesPart }) {
  if (part.state === "output-error") return <ToolError message={part.errorText} />;
  if (part.state !== "output-available") {
    return (
      <ToolStateShell icon={<ChartColumnIcon className="size-3.5" />} label="Crunching sales…" pending />
    );
  }

  const { sales, count } = part.output;
  if (!sales || sales.length === 0) {
    return (
      <ToolStateShell icon={<ChartColumnIcon className="size-3.5" />} label="No sales in that range." pending={false} />
    );
  }

  return (
    <Panel title="Sales by product" count={count}>
      <table className="w-full text-left text-xs">
        <thead className="text-[11px] uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-1.5 font-medium">Product</th>
            <th className="px-3 py-1.5 font-medium">Units</th>
            <th className="px-3 py-1.5 font-medium">Orders</th>
            <th className="px-3 py-1.5 font-medium">Revenue</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {sales.slice(0, 10).map((row: ProductSalesRow) => (
            <tr key={row.productId}>
              <td className="px-3 py-1.5">
                <div className="font-medium text-foreground">{row.product.name}</div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {row.productId}
                </div>
              </td>
              <td className="px-3 py-1.5 font-mono">{row.unitsSold}</td>
              <td className="px-3 py-1.5 font-mono">{row.ordersCount}</td>
              <td className="px-3 py-1.5 font-mono">
                {formatPrice(row.revenue, row.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function CatalogSearchPart({ part }: { part: SearchPart }) {
  if (part.state === "output-error") return <ToolError message={part.errorText} />;
  if (part.state !== "output-available") {
    return (
      <ToolStateShell icon={<PackageSearchIcon className="size-3.5" />} label="Searching the catalog…" pending />
    );
  }

  const products = part.output;
  if (products.length === 0) {
    return (
      <ToolStateShell icon={<PackageSearchIcon className="size-3.5" />} label="No products matched." pending={false} />
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

function CatalogCategoriesPart({ part }: { part: CategoriesPart }) {
  if (part.state === "output-error") return <ToolError message={part.errorText} />;
  if (part.state !== "output-available") {
    return (
      <ToolStateShell icon={<ShapesIcon className="size-3.5" />} label="Loading categories…" pending />
    );
  }

  const categories = part.output;
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
