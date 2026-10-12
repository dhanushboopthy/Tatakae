// Thirukkural 619 (அதிகாரம்: ஆள்வினையுடைமை, "persistent effort") — the app's one fixed line, chosen by
// the owner. Public-domain classical Tamil, so it is quoted as written. Shown at calm moments only
// (login, shutdown, welcome back); never on Morning, which stays one screen.

export const KURAL_619 = {
  number: 619,
  lines: ["தெய்வத்தான் ஆகா தெனினும் முயற்சிதன்", "மெய்வருத்தக் கூலி தரும்."],
  meaning: "Even if fate won't grant it, effort pays back the sweat you put in.",
} as const;

export function Kural({ className = "", meaning = true }: { className?: string; meaning?: boolean }) {
  return (
    <figure className={`m-0 border-l-2 border-lime-deep pl-4 ${className}`}>
      <blockquote lang="ta" className="m-0 text-lg font-semibold leading-relaxed">
        {KURAL_619.lines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </blockquote>
      <figcaption className="mt-1.5 text-sm text-ink-2">
        <span lang="ta">திருக்குறள் {KURAL_619.number}</span>
        {meaning && <span className="block">{KURAL_619.meaning}</span>}
      </figcaption>
    </figure>
  );
}
