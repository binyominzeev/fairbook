"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  postId: string;
}

export default function GenerateReflectionButton({ postId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/posts/${postId}/reflect`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        router.refresh();
      } else {
        setError(data.error ?? "Failed to generate reflection.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <p className="text-sm text-slate-600 mb-3">
        This discussion has enough comments for an AI reflection — a summary of
        what participants agree on, disagree about, and have left unresolved.
      </p>
      <p className="text-xs text-slate-400 mb-3 italic">
        The AI is not a judge. It is a mirror.
      </p>
      <button
        onClick={generate}
        disabled={loading}
        className="text-sm px-4 py-2 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-lg font-medium transition-colors"
      >
        {loading ? "Generating reflection…" : "🪞 Generate thread reflection"}
      </button>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
