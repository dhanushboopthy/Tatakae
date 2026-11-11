import { KURALS, type KuralNumber, type KuralText } from "@tatakae/core";

// Thirukkural, one per calm moment (the list and the rules live in core/kural.ts, shared with the phone).

export { KURALS, type KuralNumber };

export function Kural({
  n = 619,
  size = "md",
  className = "",
  meaning = true,
}: {
  n?: KuralNumber;
  size?: "md" | "sm";
  className?: string;
  meaning?: boolean;
}) {
  const kural: KuralText = KURALS[n];
  const sm = size === "sm";
  return (
    <figure className={`m-0 border-l-2 border-lime-deep ${sm ? "pl-3" : "pl-4"} ${className}`}>
      <blockquote lang="ta" className={`m-0 font-semibold leading-relaxed ${sm ? "text-base" : "text-lg"}`}>
        {kural.lines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </blockquote>
      <figcaption className={`mt-1.5 text-ink-2 ${sm ? "text-xs" : "text-sm"}`}>
        <span lang="ta">திருக்குறள் {n}</span>
        {meaning && <span className="block">{kural.meaning}</span>}
      </figcaption>
    </figure>
  );
}
