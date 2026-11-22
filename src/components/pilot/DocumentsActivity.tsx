"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchRecords, postDocument } from "@/lib/api-client";
import type {
  ActivityEvent,
  DocumentRecord,
  SessionUser,
} from "@/lib/types";
import { Button, SectionLabel, StatusChip } from "@/components/ui";

export default function DocumentsActivity({
  user,
  propertyId,
  onBack,
  onToast,
  onError,
}: {
  user: SessionUser;
  propertyId: string;
  onBack: () => void;
  onToast: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [people, setPeople] = useState<
    { id: string; name: string; role: string }[]
  >([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] =
    useState<DocumentRecord["category"]>("other");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchRecords();
    setDocuments(data.documents);
    setActivity(data.activity);
    setPeople(data.people);
  }, []);

  useEffect(() => {
    load().catch((e) => onError(e.message));
  }, [load, onError]);

  async function addDoc() {
    if (title.trim().length < 2) {
      onError("Enter a document title");
      return;
    }
    setBusy(true);
    try {
      await postDocument({
        propertyId,
        title,
        category,
        fileName: `${title.trim().replace(/\s+/g, "-").toLowerCase()}.pdf`,
        note: "Pilot metadata only — illustrative file reference.",
      });
      setTitle("");
      await load();
      onToast("Document metadata added");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const canAdd =
    user.role === "manager" ||
    user.role === "owner" ||
    user.role === "tenant";

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
        <SectionLabel>Shared property record</SectionLabel>
        <h1 className="display mt-1 text-3xl font-semibold">
          Documents & activity
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Visibility is role-filtered on the server. Files are metadata-only in
          Phase 1 (no blob storage yet).
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel p-5">
          <SectionLabel>Documents</SectionLabel>
          <ul className="mt-3 space-y-2">
            {documents.map((d) => (
              <li
                key={d.id}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{d.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {d.fileName} ·{" "}
                      {people.find((p) => p.id === d.uploadedByUserId)?.name ||
                        "someone"}
                    </p>
                    {d.note && (
                      <p className="mt-1 text-xs text-[var(--ink-soft)]">
                        {d.note}
                      </p>
                    )}
                  </div>
                  <StatusChip tone="neutral">{d.category}</StatusChip>
                </div>
              </li>
            ))}
            {documents.length === 0 && (
              <li className="text-sm text-[var(--muted)]">
                No documents visible for your role.
              </li>
            )}
          </ul>

          {canAdd && (
            <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-4">
              <p className="text-sm font-semibold">Add document reference</p>
              <div className="flex flex-wrap gap-2">
                <select
                  className="rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm"
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as DocumentRecord["category"])
                  }
                >
                  {(
                    [
                      "lease",
                      "insurance",
                      "inspection",
                      "invoice",
                      "photo",
                      "statement",
                      "other",
                    ] as const
                  ).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  className="min-w-[10rem] flex-1 rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm"
                  placeholder="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <Button disabled={busy} onClick={addDoc}>
                  Add
                </Button>
              </div>
            </div>
          )}
        </section>

        <section className="panel p-5">
          <SectionLabel>Activity history</SectionLabel>
          <ol className="timeline-rail relative mt-4 max-h-[28rem] space-y-4 overflow-auto pl-8">
            {activity.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -left-8 top-1 h-5 w-5 rounded-full border-2 border-[var(--accent)] bg-[var(--accent)]" />
                <p className="text-sm font-medium text-[var(--ink-soft)]">
                  {a.message}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {a.kind} · {new Date(a.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
            {activity.length === 0 && (
              <li className="text-sm text-[var(--muted)]">No activity yet.</li>
            )}
          </ol>
        </section>
      </div>
    </div>
  );
}
