"use client";

import { useEffect, useState } from "react";

type Tag = { id: string; name: string; color: string };
type FilterMode = "whitelist" | "blacklist" | "none";

export default function TagFilterBar() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [mode, setMode] = useState<FilterMode>("none");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const [tagsRes, prefsRes] = await Promise.all([fetch("/api/tags"), fetch("/api/users/tag-filter")]);
      if (tagsRes.ok) {
        const td = await tagsRes.json();
        setTags(td.tags || []);
      }
      if (prefsRes.ok) {
        const pd = await prefsRes.json();
        if (pd.mode === "whitelist" || pd.mode === "blacklist") setMode(pd.mode);
        setSelected(new Set(pd.tagIds || []));
      }
    })();
  }, []);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const save = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users/tag-filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: mode === "none" ? null : mode, tagIds: Array.from(selected) }),
      });
      if (!res.ok) alert("Could not save preferences");
      else location.reload();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 mb-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Feed tag filters</h3>
          <p className="text-xs text-slate-500">Choose tags and filter your feed with whitelist or blacklist mode.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={mode} onChange={(e) => setMode(e.target.value as FilterMode)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="none">No filter</option>
            <option value="whitelist">Whitelist (only these)</option>
            <option value="blacklist">Blacklist (exclude these)</option>
          </select>
          <button onClick={save} disabled={loading} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">Save</button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {tags.map((t) => (
          <button key={t.id} onClick={() => toggle(t.id)} className={`rounded-full px-3 py-1 text-xs font-medium ${selected.has(t.id) ? "ring-2 ring-offset-1" : "opacity-90"}`} style={{ background: t.color, color: "white" }}>
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}
