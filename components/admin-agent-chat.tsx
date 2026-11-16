"use client";

import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@ai-sdk/workflow/client";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { AdminToolPart } from "@/components/admin-tool-parts";
import type { AdminUIMessage } from "@/lib/admin-agent";
import { ShieldCheckIcon, SquareTerminalIcon } from "lucide-react";
import { useMemo, useState } from "react";

const SUGGESTIONS = [
  "Show me low-stock items",
  "What were yesterday's top sellers?",
  "Summarize this week's revenue",
  "How many open urgent support tickets do we have?",
];

const WORKFLOW_RUN_ID_KEY = "admin-active-workflow-run-id";

/**
 * Store admin chat. Same durable client wiring as the shopping chat, but
 * pointed at `/api/admin/chat` and rendered inside the password-gated
 * `/admin` page. Falls back cleanly to 401 handling if the admin cookie
 * expires mid-session.
 */
export function AdminAgentChat() {
  const [input, setInput] = useState("");

  // On refresh, pick up an in-flight admin chat run so the response keeps
  // streaming instead of starting over.
  const activeRunId = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return localStorage.getItem(WORKFLOW_RUN_ID_KEY) ?? undefined;
  }, []);

  const transport = useMemo(
    () =>
      new WorkflowChatTransport<AdminUIMessage>({
        api: "/api/admin/chat",
        onChatSendMessage: (response) => {
          const runId = response.headers.get("x-workflow-run-id");
          if (runId) localStorage.setItem(WORKFLOW_RUN_ID_KEY, runId);
        },
        onChatEnd: () => {
          localStorage.removeItem(WORKFLOW_RUN_ID_KEY);
        },
        prepareReconnectToStreamRequest: (options) => {
          const runId = localStorage.getItem(WORKFLOW_RUN_ID_KEY);
          if (!runId) throw new Error("No active workflow run ID found");
          const { api: _ignored, ...rest } = options;
          return {
            ...rest,
            api: `/api/admin/chat/${encodeURIComponent(runId)}/stream`,
          };
        },
      }),
    [],
  );

  const { messages, status, error, stop, clearError, sendMessage } =
    useChat<AdminUIMessage>({
      resume: Boolean(activeRunId),
      transport,
    });

  const busy = status === "submitted" || status === "streaming";

  const handleSubmit = (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput("");
  };

  const handleSuggestion = (suggestion: string) => {
    if (busy) return;
    sendMessage({ text: suggestion });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Store Admin Agent"
              description="Back-office help: returns, inventory, sales, support tickets, and sandboxed computation."
              icon={
                <ShieldCheckIcon className="size-10 text-muted-foreground" />
              }
            >
              <Suggestions>
                {SUGGESTIONS.map((suggestion) => (
                  <Suggestion
                    key={suggestion}
                    suggestion={suggestion}
                    onClick={handleSuggestion}
                  />
                ))}
              </Suggestions>
            </ConversationEmptyState>
          ) : (
            messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {message.parts.map((part, index) =>
                    part.type === "text" ? (
                      <MessageResponse key={index}>{part.text}</MessageResponse>
                    ) : (
                      <AdminToolPart key={index} part={part} />
                    ),
                  )}
                </MessageContent>
              </Message>
            ))
          )}

          {status === "submitted" && (
            <Message from="assistant">
              <MessageContent>
                <SquareTerminalIcon className="size-4 animate-pulse text-muted-foreground" />
              </MessageContent>
            </Message>
          )}

          {error && (
            <div className="flex flex-col items-start gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <span className="font-medium">The admin agent hit an error:</span>
              <span className="opacity-80">{error.message}</span>
              <button
                type="button"
                onClick={clearError}
                className="mt-1 font-medium underline underline-offset-4"
              >
                Dismiss
              </button>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border p-3">
        <PromptInput onSubmit={handleSubmit} className="rounded-lg border">
          <PromptInputBody>
            <PromptInputTextarea
              aria-label="Message the store admin agent"
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about returns, inventory, sales, support…"
              value={input}
            />
          </PromptInputBody>
          <PromptInputFooter className="justify-end border-t-none">
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
