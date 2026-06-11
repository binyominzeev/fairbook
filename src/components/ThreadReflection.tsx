"use client";

interface ReflectionData {
  agreementAreas: string[];
  disagreementAreas: string[];
  unresolvedQuestions: string[];
  qualityObservations: string[];
  createdAt: string;
}

interface Props {
  reflection: ReflectionData;
}

export default function ThreadReflection({ reflection }: Props) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mt-4">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
        🪞 Thread Reflection — AI Mirror
      </h3>
      <p className="text-xs text-slate-400 mb-4 italic">
        The AI is not a judge. It is a mirror. This is for understanding, not
        adjudication.
      </p>

      {reflection.agreementAreas.length > 0 && (
        <Section
          title="Areas of Agreement"
          icon="🤝"
          items={reflection.agreementAreas}
          color="emerald"
        />
      )}
      {reflection.disagreementAreas.length > 0 && (
        <Section
          title="Areas of Disagreement"
          icon="⚖️"
          items={reflection.disagreementAreas}
          color="blue"
        />
      )}
      {reflection.unresolvedQuestions.length > 0 && (
        <Section
          title="Unresolved Questions"
          icon="❓"
          items={reflection.unresolvedQuestions}
          color="amber"
        />
      )}
      {reflection.qualityObservations.length > 0 && (
        <Section
          title="Discourse Quality Observations"
          icon="📊"
          items={reflection.qualityObservations}
          color="slate"
        />
      )}

      <p className="text-xs text-slate-400 mt-3">
        Generated {new Date(reflection.createdAt).toLocaleString()}
      </p>
    </div>
  );
}

function Section({
  title,
  icon,
  items,
  color,
}: {
  title: string;
  icon: string;
  items: string[];
  color: "emerald" | "blue" | "amber" | "slate";
}) {
  const colors = {
    emerald: "text-emerald-700",
    blue: "text-blue-700",
    amber: "text-amber-700",
    slate: "text-slate-700",
  };
  return (
    <div className="mb-4">
      <h4 className={`text-xs font-semibold ${colors[color]} mb-2`}>
        {icon} {title}
      </h4>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-slate-700 flex gap-2">
            <span className="text-slate-400 flex-shrink-0">·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
