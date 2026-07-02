"use client";

import { useMemo, useState } from "react";

type PromptItem = {
  key: string;
  label: string;
  content: string;
  defaultContent: string;
  isCustomized: boolean;
  updatedAt: string | null;
  updatedByEmail: string | null;
};

type AppealItem = {
  id: string;
  status: string;
  requestText: string | null;
  createdAt: string;
  requester: {
    id: string;
    name: string;
    email: string;
  };
  comment: {
    id: string;
    content: string;
    moderationReason: string | null;
    moderationExplanation: string | null;
    moderationStatus: string;
    createdAt: string;
    author: {
      id: string;
      name: string;
      email: string;
    };
    post: {
      id: string;
      content: string | null;
    };
  };
  context: {
    postContent?: string;
    sharedContent?: string;
    parentComment?: string;
  } | null;
};

type OwnBlockedComment = {
  id: string;
  content: string;
  moderationReason: string | null;
  moderationExplanation: string | null;
  createdAt: string;
  post: {
    id: string;
    content: string | null;
  };
  hasOpenAppeal: boolean;
};

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export default function AdminDevSidebar() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [selectedPromptKey, setSelectedPromptKey] = useState<string>("comment_moderation");
  const [promptDraft, setPromptDraft] = useState("");
  const [promptSavePending, setPromptSavePending] = useState(false);
  const [promptTestInput, setPromptTestInput] = useState("");
  const [promptTestOutput, setPromptTestOutput] = useState("");
  const [promptTestPending, setPromptTestPending] = useState(false);

  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [selectedAppealId, setSelectedAppealId] = useState<string>("");
  const [ownBlockedComments, setOwnBlockedComments] = useState<OwnBlockedComment[]>([]);
  const [adminNote, setAdminNote] = useState("");
  const [rerunPending, setRerunPending] = useState(false);

  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatPending, setChatPending] = useState(false);

  const selectedPrompt = useMemo(
    () => prompts.find((prompt) => prompt.key === selectedPromptKey) ?? null,
    [prompts, selectedPromptKey]
  );

  const selectedAppeal = useMemo(
    () => appeals.find((appeal) => appeal.id === selectedAppealId) ?? null,
    [appeals, selectedAppealId]
  );

  const refreshData = async () => {
    setLoading(true);
    setError("");
    try {
      const [promptRes, appealRes] = await Promise.all([
        fetch("/api/admin/ai-prompts"),
        fetch("/api/admin/comment-appeals"),
      ]);

      const promptData = await promptRes.json();
      const appealData = await appealRes.json();

      if (!promptRes.ok) {
        throw new Error(promptData.error ?? "Failed to load prompt list.");
      }
      if (!appealRes.ok) {
        throw new Error(appealData.error ?? "Failed to load appeals.");
      }

      const nextPrompts: PromptItem[] = Array.isArray(promptData.prompts) ? promptData.prompts : [];
      setPrompts(nextPrompts);

      const fallbackKey = nextPrompts[0]?.key ?? "comment_moderation";
      const preferredKey =
        nextPrompts.find((item) => item.key === selectedPromptKey)?.key ??
        nextPrompts.find((item) => item.key === "comment_moderation")?.key ??
        fallbackKey;
      setSelectedPromptKey(preferredKey);
      const preferredPrompt = nextPrompts.find((item) => item.key === preferredKey);
      setPromptDraft(preferredPrompt?.content ?? "");

      const nextAppeals: AppealItem[] = Array.isArray(appealData.openAppeals)
        ? appealData.openAppeals
        : [];
      setAppeals(nextAppeals);
      setOwnBlockedComments(
        Array.isArray(appealData.ownBlockedComments) ? appealData.ownBlockedComments : []
      );

      const selectedStillExists = nextAppeals.some((item) => item.id === selectedAppealId);
      if (!selectedStillExists) {
        const nextSelectedId = nextAppeals[0]?.id ?? "";
        setSelectedAppealId(nextSelectedId);
        setChatHistory([]);
        setChatInput("");
        setAdminNote("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin dev sidebar.");
    } finally {
      setLoading(false);
    }
  };

  const openSidebar = async () => {
    setOpen(true);
    await refreshData();
  };

  const savePrompt = async () => {
    if (!selectedPrompt) return;
    setPromptSavePending(true);
    setError("");
    try {
      const res = await fetch("/api/admin/ai-prompts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: selectedPrompt.key,
          content: promptDraft,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save prompt.");
      }

      setPrompts((current) =>
        current.map((item) =>
          item.key === selectedPrompt.key
            ? {
                ...item,
                content: String(data.content ?? promptDraft),
                isCustomized: true,
                updatedAt: data.updatedAt ?? item.updatedAt,
                updatedByEmail: data.updatedByEmail ?? item.updatedByEmail,
              }
            : item
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save prompt.");
    } finally {
      setPromptSavePending(false);
    }
  };

  const resetPrompt = async () => {
    if (!selectedPrompt) return;
    setPromptSavePending(true);
    setError("");
    try {
      const res = await fetch("/api/admin/ai-prompts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: selectedPrompt.key,
          resetToDefault: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to reset prompt.");
      }

      const nextContent = String(data.content ?? selectedPrompt.defaultContent);
      setPromptDraft(nextContent);
      setPrompts((current) =>
        current.map((item) =>
          item.key === selectedPrompt.key
            ? {
                ...item,
                content: nextContent,
                isCustomized: false,
                updatedAt: null,
                updatedByEmail: null,
              }
            : item
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset prompt.");
    } finally {
      setPromptSavePending(false);
    }
  };

  const testPrompt = async () => {
    if (!selectedPrompt) return;
    if (!promptTestInput.trim()) return;

    setPromptTestPending(true);
    setError("");
    try {
      const res = await fetch("/api/admin/ai-prompts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: selectedPrompt.key,
          draftPrompt: promptDraft,
          userInput: promptTestInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Prompt test failed.");
      }
      setPromptTestOutput(String(data.output ?? ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prompt test failed.");
    } finally {
      setPromptTestPending(false);
    }
  };

  const rerunAppealModeration = async () => {
    if (!selectedAppeal) return;

    setRerunPending(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/comment-appeals/${selectedAppeal.id}/rerun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNote }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to rerun moderation.");
      }

      await refreshData();
      setAdminNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rerun moderation.");
    } finally {
      setRerunPending(false);
    }
  };

  const openSelfReviewCase = async (commentId: string) => {
    setError("");
    try {
      const response = await fetch("/api/admin/comment-appeals/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to open self-review case.");
      }

      await refreshData();
      if (data.appeal?.id) {
        setSelectedAppealId(String(data.appeal.id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open self-review case.");
    }
  };

  const sendChat = async () => {
    if (!selectedAppeal || !chatInput.trim()) return;

    const userTurn: ChatTurn = { role: "user", content: chatInput.trim() };
    const nextHistory = [...chatHistory, userTurn];

    setChatHistory(nextHistory);
    setChatInput("");
    setChatPending(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/comment-appeals/${selectedAppeal.id}/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userTurn.content,
          history: chatHistory,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Copilot discussion failed.");
      }

      const reply = String(data.reply ?? "No response.");
      const suggestedPromptPatch = String(data.suggestedPromptPatch ?? "");
      const riskNotes = Array.isArray(data.riskNotes)
        ? data.riskNotes.filter((note: unknown): note is string => typeof note === "string")
        : [];

      const fullReply =
        suggestedPromptPatch || riskNotes.length > 0
          ? [
              reply,
              suggestedPromptPatch ? `\n\nSuggested prompt patch:\n${suggestedPromptPatch}` : "",
              riskNotes.length > 0 ? `\n\nRisk notes:\n- ${riskNotes.join("\n- ")}` : "",
            ]
              .filter(Boolean)
              .join("")
          : reply;

      setChatHistory((current) => [...current, { role: "assistant", content: fullReply }]);

      if (suggestedPromptPatch && selectedPromptKey === "comment_moderation") {
        setPromptDraft(suggestedPromptPatch);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Copilot discussion failed.");
    } finally {
      setChatPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void openSidebar()}
        className="fixed bottom-4 right-4 z-40 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-lg transition-colors hover:bg-slate-50"
      >
        Dev Sidebar
      </button>

      {open && (
        <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
          <div className="sticky top-0 border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Admin Dev Sidebar</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void refreshData()}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
            {loading && <p className="mt-2 text-xs text-slate-500">Loading…</p>}
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </div>

          <div className="space-y-5 px-4 py-4">
            <section className="space-y-2 rounded-lg border border-slate-200 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Prompt Control
              </h3>

              <select
                value={selectedPromptKey}
                onChange={(event) => {
                  const nextKey = event.target.value;
                  setSelectedPromptKey(nextKey);
                  const nextPrompt = prompts.find((prompt) => prompt.key === nextKey);
                  setPromptDraft(nextPrompt?.content ?? "");
                  setPromptTestOutput("");
                }}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900"
              >
                {prompts.map((prompt) => (
                  <option key={prompt.key} value={prompt.key}>
                    {prompt.label}
                    {prompt.isCustomized ? " (custom)" : ""}
                  </option>
                ))}
              </select>

              <textarea
                value={promptDraft}
                onChange={(event) => setPromptDraft(event.target.value)}
                rows={12}
                className="w-full rounded-md border border-slate-300 px-2 py-2 font-mono text-[11px] text-slate-900"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void savePrompt()}
                  disabled={promptSavePending || !selectedPrompt}
                  className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
                >
                  {promptSavePending ? "Saving…" : "Save prompt"}
                </button>
                <button
                  type="button"
                  onClick={() => void resetPrompt()}
                  disabled={promptSavePending || !selectedPrompt}
                  className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 disabled:opacity-60"
                >
                  Reset to default
                </button>
              </div>

              <p className="text-[11px] text-slate-500">
                Test this prompt with custom input (dry run):
              </p>
              <textarea
                value={promptTestInput}
                onChange={(event) => setPromptTestInput(event.target.value)}
                rows={3}
                placeholder="Paste test input for this prompt..."
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900"
              />
              <button
                type="button"
                onClick={() => void testPrompt()}
                disabled={promptTestPending || !selectedPrompt}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 disabled:opacity-60"
              >
                {promptTestPending ? "Testing…" : "Run prompt test"}
              </button>
              {promptTestOutput && (
                <pre className="max-h-48 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] whitespace-pre-wrap text-slate-800">
                  {promptTestOutput}
                </pre>
              )}
            </section>

            <section className="space-y-2 rounded-lg border border-slate-200 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Open Appeals
              </h3>
              {appeals.length === 0 ? (
                <p className="text-xs text-slate-500">No open appeals.</p>
              ) : (
                <ul className="space-y-2">
                  {appeals.map((appeal) => (
                    <li key={appeal.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAppealId(appeal.id);
                          setChatHistory([]);
                          setChatInput("");
                        }}
                        className={`w-full rounded-md border px-2 py-2 text-left text-xs transition-colors ${
                          selectedAppealId === appeal.id
                            ? "border-blue-300 bg-blue-50"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <p className="font-medium text-slate-800">
                          {appeal.requester.name} ({appeal.requester.email})
                        </p>
                        <p className="mt-1 line-clamp-2 text-slate-600">{appeal.comment.content}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {selectedAppeal && (
                <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                  <p className="text-xs font-medium text-slate-700">Selected appeal context</p>
                  <p className="text-[11px] text-slate-700">
                    Reason: {selectedAppeal.comment.moderationReason ?? "n/a"}
                  </p>
                  <p className="text-[11px] text-slate-700 whitespace-pre-wrap">
                    Explanation: {selectedAppeal.comment.moderationExplanation ?? "n/a"}
                  </p>
                  {selectedAppeal.requestText && (
                    <p className="text-[11px] text-slate-700 whitespace-pre-wrap">
                      User appeal note: {selectedAppeal.requestText}
                    </p>
                  )}
                  {selectedAppeal.context?.postContent && (
                    <p className="text-[11px] text-slate-700 whitespace-pre-wrap">
                      Post: {selectedAppeal.context.postContent}
                    </p>
                  )}
                  {selectedAppeal.context?.parentComment && (
                    <p className="text-[11px] text-slate-700 whitespace-pre-wrap">
                      Parent comment: {selectedAppeal.context.parentComment}
                    </p>
                  )}

                  <textarea
                    value={adminNote}
                    onChange={(event) => setAdminNote(event.target.value)}
                    rows={2}
                    placeholder="Optional admin note for audit log"
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => void rerunAppealModeration()}
                    disabled={rerunPending}
                    className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
                  >
                    {rerunPending ? "Running…" : "Re-run moderation with current prompt"}
                  </button>
                </div>
              )}
            </section>

            <section className="space-y-2 rounded-lg border border-slate-200 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Copilot Discussion (selected appeal)
              </h3>
              {!selectedAppeal ? (
                <p className="text-xs text-slate-500">Select an appeal first.</p>
              ) : (
                <>
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2">
                    {chatHistory.length === 0 ? (
                      <p className="text-[11px] text-slate-500">
                        Ask: why blocked, what is false positive, and how to improve prompt.
                      </p>
                    ) : (
                      chatHistory.map((turn, index) => (
                        <div key={`${turn.role}-${index}`}>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            {turn.role}
                          </p>
                          <p className="whitespace-pre-wrap text-[11px] text-slate-800">{turn.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <textarea
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    rows={2}
                    placeholder="What was wrong with this moderation decision? Suggest a safer prompt patch."
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => void sendChat()}
                    disabled={chatPending || !chatInput.trim()}
                    className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 disabled:opacity-60"
                  >
                    {chatPending ? "Sending…" : "Send"}
                  </button>
                </>
              )}
            </section>

            <section className="space-y-2 rounded-lg border border-slate-200 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Your filtered comments
              </h3>
              {ownBlockedComments.length === 0 ? (
                <p className="text-xs text-slate-500">No filtered comments.</p>
              ) : (
                <ul className="space-y-2">
                  {ownBlockedComments.map((comment) => (
                    <li key={comment.id} className="rounded-md border border-slate-200 p-2 text-xs">
                      <p className="line-clamp-2 text-slate-800">{comment.content}</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {comment.hasOpenAppeal ? "Open appeal" : "No open appeal"}
                      </p>
                      {!comment.hasOpenAppeal && (
                        <button
                          type="button"
                          onClick={() => void openSelfReviewCase(comment.id)}
                          className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                        >
                          Open as review case
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </aside>
      )}
    </>
  );
}
