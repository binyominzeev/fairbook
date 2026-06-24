type Props = {
  text: string;
  query?: string;
  className?: string;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function HighlightedText({ text, query, className }: Props) {
  const trimmedQuery = query?.trim() ?? "";

  if (!trimmedQuery) {
    return className ? <span className={className}>{text}</span> : <>{text}</>;
  }

  const regex = new RegExp(`(${escapeRegExp(trimmedQuery)})`, "gi");
  const parts = text.split(regex);

  const content = (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark
            key={`${part}:${index}`}
            className="rounded bg-amber-100 px-0.5 text-inherit"
          >
            {part}
          </mark>
        ) : (
          <span key={`${part}:${index}`}>{part}</span>
        )
      )}
    </>
  );

  return className ? <span className={className}>{content}</span> : content;
}
