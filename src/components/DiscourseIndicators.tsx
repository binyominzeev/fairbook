"use client";

import { useState } from "react";
import type { DiscourseSignal } from "@/lib/ai";
import {
  SIGNAL_ICONS,
  SIGNAL_LABELS,
  SIGNAL_CATEGORY,
  SIGNAL_COLORS,
} from "./signals";

interface Analysis {
  positiveSignals: DiscourseSignal[];
  negativeSignals: DiscourseSignal[];
  neutralSignals: DiscourseSignal[];
  explanation: string;
}

interface Props {
  analysis: Analysis | null;
}

export default function DiscourseIndicators({ analysis }: Props) {
  const [tooltip, setTooltip] = useState<DiscourseSignal | null>(null);

  if (!analysis) {
    return (
      <span className="text-xs text-slate-400 italic">Analyzing…</span>
    );
  }

  const allSignals: DiscourseSignal[] = [
    ...analysis.positiveSignals,
    ...analysis.neutralSignals,
    ...analysis.negativeSignals,
  ];

  if (allSignals.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {allSignals.map((signal) => {
        const cat = SIGNAL_CATEGORY[signal];
        const colorClass = SIGNAL_COLORS[cat];
        return (
          <div key={signal} className="relative group">
            <button
              onMouseEnter={() => setTooltip(signal)}
              onMouseLeave={() => setTooltip(null)}
              className={`text-xs px-1.5 py-0.5 rounded border ${colorClass} cursor-default select-none`}
              title={SIGNAL_LABELS[signal]}
            >
              {SIGNAL_ICONS[signal]} {SIGNAL_LABELS[signal]}
            </button>
            {tooltip === signal && (
              <div className="absolute bottom-full left-0 z-50 mb-1 w-[min(16rem,calc(100vw-2rem))] rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg pointer-events-none sm:w-64">
                <p className="font-medium mb-1">{SIGNAL_LABELS[signal]}</p>
                <p className="text-slate-300">{analysis.explanation}</p>
                <p className="mt-1 text-slate-400 italic text-[10px]">
                  AI-generated · not a judgment
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
