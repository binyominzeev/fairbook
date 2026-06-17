"use client";

import { useEffect, useState } from "react";

type Tag = { id: string; name: string; color: string; keywords?: string };

export default function AdminTagsManager() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#9CA3AF");
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchTags = async () => {
    const res = await fetch("/api/tags");
    const data = await res.json();
    if (res.ok) setTags(data.tags || []);
  };

  useEffect(() => {
    void (async () => {
      await fetchTags();
    })();
  }, []);

  const createTag = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color, keywords }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create tag.");
      } else {
        setName("");
        setKeywords("");
        setColor("#9CA3AF");
        await fetchTags();
      }
    } finally {
      setLoading(false);
    }
  };

  const updateTag = async (id: string, body: Partial<Tag>) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/tags/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Could not update tag.");
      else await fetchTags();
    } finally {
      setLoading(false);
    }
  };

  const deleteTag = async (id: string) => {
    if (!confirm("Delete this tag?")) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/tags/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Could not delete tag.");
      else await fetchTags();
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-700">Tag management</h2>
        <p className="text-xs text-slate-500 mt-1">Create and edit tags used for automatic classification and filtering.</p>
      </div>

      <form onSubmit={createTag} className="space-y-3 rounded-lg bg-slate-50 p-4 border border-slate-200">
        <div className="grid gap-3 md:grid-cols-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tag name, e.g. Sport" className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none" />
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="keywords, comma separated" className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <button disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{loading ? "Saving..." : "Create tag"}</button>
        </div>
      </form>

      <div className="space-y-3">
        {tags.length === 0 ? (
          <p className="text-sm text-slate-400">No tags yet.</p>
        ) : (
          tags.map((tag) => (
            <div key={tag.id} className="rounded-lg border border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="rounded-full px-2 py-1 text-xs font-medium" style={{ background: tag.color, color: "white" }}>{tag.name}</span>
                <div className="text-xs text-slate-500">{tag.keywords}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => {
                  const newName = prompt("New name:", tag.name);
                  if (newName) void updateTag(tag.id, { name: newName });
                }} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Rename</button>
                <button onClick={() => {
                  const newKeywords = prompt("Keywords (comma separated):", tag.keywords || "");
                  if (newKeywords !== null) void updateTag(tag.id, { keywords: newKeywords });
                }} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Edit keywords</button>
                <button onClick={() => {
                  const newColor = prompt("Hex color:", tag.color);
                  if (newColor) void updateTag(tag.id, { color: newColor });
                }} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Change color</button>
                <button onClick={() => deleteTag(tag.id)} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
