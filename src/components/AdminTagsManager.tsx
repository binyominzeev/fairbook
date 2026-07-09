"use client";

import { useEffect, useState } from "react";

type Tag = { id: string; name: string; color: string; description?: string | null };

export default function AdminTagsManager() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#9CA3AF");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generatingDescription, setGeneratingDescription] = useState(false);

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

  // Generate description suggestion when tag name changes
  const generateDescriptionSuggestion = async () => {
    if (!name.trim()) return;
    setGeneratingDescription(true);
    try {
      const res = await fetch("/api/tags/suggest-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagName: name.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.description) {
        setDescription(data.description);
      }
    } finally {
      setGeneratingDescription(false);
    }
  };

  const createTag = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          color,
          description: description || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create tag.");
      } else {
        setName("");
        setColor("#9CA3AF");
        setDescription("");
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
        <p className="text-xs text-slate-500 mt-1">Create and edit tags used for AI-based classification and filtering.</p>
      </div>

      <form onSubmit={createTag} className="space-y-3 rounded-lg bg-slate-50 p-4 border border-slate-200">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            placeholder="Tag name, e.g. Sport"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
          />
        </div>
        
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-slate-600">Description (helps AI)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., sports news, competitions, matches, players"
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none mt-1"
            />
          </div>
          <button
            type="button"
            onClick={generateDescriptionSuggestion}
            disabled={!name.trim() || generatingDescription}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {generatingDescription ? "Suggesting..." : "Suggest"}
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <button
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Create tag"}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {tags.length === 0 ? (
          <p className="text-sm text-slate-400">No tags yet.</p>
        ) : (
          tags.map((tag) => (
            <div key={tag.id} className="rounded-lg border border-slate-200 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="rounded-full px-2 py-1 text-xs font-medium text-white"
                    style={{ background: tag.color }}
                  >
                    {tag.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const newName = prompt("New name:", tag.name);
                      if (newName) void updateTag(tag.id, { name: newName });
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => {
                      const newColor = prompt("Hex color:", tag.color);
                      if (newColor) void updateTag(tag.id, { color: newColor });
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Change color
                  </button>
                  <button
                    onClick={() => deleteTag(tag.id)}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {tag.description && (
                <div className="ml-2">
                  <p className="text-xs text-slate-600">{tag.description}</p>
                  <button
                    onClick={() => {
                      const newDesc = prompt("Update description:", tag.description || "");
                      if (newDesc !== null) void updateTag(tag.id, { description: newDesc });
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                  >
                    Edit description
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
