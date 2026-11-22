"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createMessageThread,
  fetchMessages,
  postMessageReply,
} from "@/lib/api-client";
import type {
  Message,
  MessageThread,
  SessionUser,
} from "@/lib/types";
import { Button, SectionLabel, StatusChip } from "@/components/ui";

export default function MessagesPanel({
  user,
  propertyId,
  initialWorkOrderId,
  onBack,
  onToast,
  onError,
}: {
  user: SessionUser;
  propertyId: string;
  initialWorkOrderId?: string | null;
  onBack: () => void;
  onToast: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [people, setPeople] = useState<
    { id: string; name: string; role: string }[]
  >([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [subject, setSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [busy, setBusy] = useState(false);

  const loadThreads = useCallback(async () => {
    const data = await fetchMessages();
    setThreads(data.threads);
    setPeople(data.people || []);
    return data.threads;
  }, []);

  const openThread = useCallback(
    async (threadId: string) => {
      const data = await fetchMessages({ threadId });
      setSelectedId(threadId);
      setMessages(data.messages || []);
      if (data.threads) setThreads(data.threads);
    },
    [],
  );

  useEffect(() => {
    (async () => {
      try {
        const list = await loadThreads();
        if (initialWorkOrderId) {
          const match = list.find((t) => t.workOrderId === initialWorkOrderId);
          if (match) {
            await openThread(match.id);
            return;
          }
        }
        if (list[0]) await openThread(list[0].id);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Failed to load messages");
      }
    })();
  }, [initialWorkOrderId, loadThreads, openThread, onError]);

  const selected = useMemo(
    () => threads.find((t) => t.id === selectedId) || null,
    [threads, selectedId],
  );

  async function reply() {
    if (!selectedId || draft.trim().length < 1) return;
    setBusy(true);
    try {
      await postMessageReply(selectedId, draft);
      setDraft("");
      await openThread(selectedId);
      onToast("Message sent");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  async function startThread() {
    if (user.role === "contractor") return;
    if (subject.trim().length < 2 || newBody.trim().length < 1) {
      onError("Subject and message required");
      return;
    }
    setBusy(true);
    try {
      const { thread } = await createMessageThread({
        propertyId,
        subject,
        body: newBody,
      });
      setSubject("");
      setNewBody("");
      await loadThreads();
      await openThread(thread.id);
      onToast("Thread created");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  function authorName(id: string) {
    return people.find((p) => p.id === id)?.name || "Someone";
  }

  return (
    <div className="fade-in space-y-5">
      <header>
        <button
          type="button"
          className="text-sm font-medium text-[var(--accent)]"
          onClick={onBack}
        >
          ← Back
        </button>
        <SectionLabel>Property & work-order threads</SectionLabel>
        <h1 className="display mt-1 text-3xl font-semibold">Messages</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Threads are tied to the property or a work order. Participants are
          notified; access is server-enforced.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.2fr]">
        <aside className="panel overflow-hidden">
          <div className="border-b border-[var(--line)] px-4 py-3">
            <h2 className="display text-lg font-semibold">Threads</h2>
          </div>
          <ul className="divide-y divide-[var(--line)]">
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={`flex w-full flex-col items-start gap-1 px-4 py-3 text-left hover:bg-[var(--surface-2)] ${
                    selectedId === t.id ? "bg-[var(--accent-soft)]" : ""
                  }`}
                  onClick={() => openThread(t.id)}
                >
                  <span className="text-sm font-semibold">{t.subject}</span>
                  <span className="flex flex-wrap gap-1">
                    <StatusChip tone={t.workOrderId ? "warn" : "accent"}>
                      {t.workOrderId ? "Work order" : "Property"}
                    </StatusChip>
                    <span className="text-xs text-[var(--muted)]">
                      {new Date(t.updatedAt).toLocaleString()}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {threads.length === 0 && (
              <li className="px-4 py-6 text-sm text-[var(--muted)]">
                No threads yet.
              </li>
            )}
          </ul>

          {user.role !== "contractor" && (
            <div className="space-y-2 border-t border-[var(--line)] p-4">
              <p className="text-sm font-semibold">New property thread</p>
              <input
                className="w-full rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm"
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              <textarea
                className="w-full rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm"
                rows={2}
                placeholder="First message"
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
              />
              <Button disabled={busy} onClick={startThread}>
                Start thread
              </Button>
            </div>
          )}
        </aside>

        <section className="panel flex min-h-[22rem] flex-col p-5">
          {selected ? (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <SectionLabel>
                    {selected.workOrderId ? "Work-order thread" : "Property thread"}
                  </SectionLabel>
                  <h2 className="display text-xl font-semibold">
                    {selected.subject}
                  </h2>
                </div>
              </div>
              <ul className="flex-1 space-y-3 overflow-auto">
                {messages.map((m) => {
                  const mine = m.authorUserId === user.id;
                  return (
                    <li
                      key={m.id}
                      className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
                        mine
                          ? "ml-auto bg-[var(--accent)] text-white"
                          : "bg-[var(--surface-2)] text-[var(--ink)]"
                      }`}
                    >
                      <p className={`text-xs ${mine ? "text-white/75" : "text-[var(--muted)]"}`}>
                        {authorName(m.authorUserId)}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
                      <p className={`mt-1 text-[0.65rem] ${mine ? "text-white/60" : "text-[var(--muted)]"}`}>
                        {new Date(m.createdAt).toLocaleString()}
                      </p>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
                <textarea
                  className="min-h-[2.75rem] min-w-[12rem] flex-1 rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Write a reply…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <Button disabled={busy || !draft.trim()} onClick={reply}>
                  Send
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--muted)]">Select a thread.</p>
          )}
        </section>
      </div>
    </div>
  );
}
