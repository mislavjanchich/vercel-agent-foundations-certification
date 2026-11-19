"use client";

import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@ai-sdk/workflow/client";
import type { UIMessage } from "ai";
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
import { Suggestion } from "@/components/ai-elements/suggestion";
import { useEffect, useMemo, useState } from "react";

/**
 * sessionStorage key for the "Ask about this product" draft. Written by
 * `AskAboutProduct`, consumed + cleared once by the chat shell on mount.
 */
export const AGENT_ASK_DRAFT_KEY = "agent:ask-draft";

/**
 * Shared chat client for both agents (shopping + admin).
 *
 * The two agents use identical durable-chat plumbing — `useChat` over a
 * `WorkflowChatTransport`, refresh recovery via a localStorage run id,
 * AI Elements conversation UI, and sugŧested prompts — and differ only in
 * the endpoint paths, copy, and how tool invocations render. This component
 * holds the shared part; each agent page passes its own props.
 */
export function AgentChatShell<T extends UIMessage = UIMessage>({
  api,
  streamPath,
  runStorageKey,
  suggestions,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  inputPlaceholder,
  inputAriaLabel,
  renderPart,
}: {
  /** POST endpoint that starts the chat run (e.g. `/api/admin/chat`). */
  api: string;
  /** Builds the resume endpoint for a run id. */
  streamPath: (runId: string) => string;
  /** localStorage key holding the active run id (one per agent). */
  runStorageKey: string;
  suggestions: string[];
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon: React.ReactNode;
  inputPlaceholder: string;
  inputAriaLabel: string;
  renderPart: (part: T["parts"][number], index: number) => React.ReactNode;
}) {
  const [input, setInput] = useState("");

  // On refresh, pick up an in-flight chat run so the response keeps
  // streaming instead of starting over.
  const activeRunId = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return localStorage.getItem(runStorageKey) ?? undefined;
  }, [runStorageKey]);

  const transport = useMemo(
    () =>
      new WorkflowChatTransport<T>({
        api,
        onChatSendMessage: (response) => {
          const runId = response.headers.get("x-workflow-run-id");
          if (runId) localStorage.setItem(runStorageKey, runId);
        },
        onChatEnd: () => {
          localStorage.removeItem(runStorageKey);
        },
        prepareReconnectToStreamRequest: (options) => {
          const runId = localStorage.getItem(runStorageKey);
          if (!runId) throw new Error("No active workflow run ID found");
          const { api: _ignored, ...rest } = options;
          return {
            ...rest,
            api: streamPath(runId),
          };
        },
      }),
    [api, runStorageKey, streamPath],
  );

  const { messages, status, error, stop, clearError, sendMessage } =
    useChat<T>({
      resume: Boolean(activeRunId),
      transport,
    });

  const busy = status === "submitted" || status === "streaming";

  // Pick up an "Ask about this product" draft: either a sessionStorage draft
  // left by the product page button (panel was closed, shell unmounted) or a
  // live `agent:ask` event (shell already mounted). Draft only — never sent.
  useEffect(() => {
    const draft = sessionStorage.getItem(AGENT_ASK_DRAFT_KEY);
    if (draft) {
      sessionStorage.removeItem(AGENT_ASK_DRAFT_KEY);
      setInput(draft);
    }
    const onAsk = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail
        ?.message;
      if (message) setInput(message);
    };
    window.addEventListener("agent:ask", onAsk);
    return () => window.removeEventListener("agent:ask", onAsk);
  }, []);

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
              title={emptyTitle}
              description={emptyDescription}
              icon={emptyIcon}
            >
              <div className="flex max-w-xs flex-wrap justify-center gap-2">
                {suggestions.map((suggestion) => (
                  <Suggestion
                    key={suggestion}
                    suggestion={suggestion}
                    onClick={handleSuggestion}
                  />
                ))}
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {message.parts.map((part, index) => {
                    if ((part as { type?: string }).type === "text") {
                      return (
                        <MessageResponse key={index}>
                          {(part as { text: string }).text}
                        </MessageResponse>
                      );
                    }
                    return renderPart(part, index);
                  })}
                </MessageContent>
              </Message>
            ))
          )}

          {status === "submitted" && (
            <Message from="assistant">
              <MessageContent>
                <span
                  className="inline-block size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground"
                  aria-label="Agent is working"
                />
              </MessageContent>
            </Message>
          )}

          {error && (
            <div className="flex flex-col items-start gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <span className="font-medium">The agent hit an error:</span>
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
              aria-label={inputAriaLabel}
              onChange={(event) => setInput(event.target.value)}
              placeholder={inputPlaceholder}
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
