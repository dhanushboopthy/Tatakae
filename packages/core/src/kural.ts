// Thirukkural, one per calm moment, chosen by the owner. 619 (ஆள்வினையுடைமை, "persistent effort") is the
// app's own line on Login; every other screen gets the one that fits it (docs/05). Public-domain classical
// Tamil, so it is quoted as written. Never on Morning (one screen) or on a running focus timer.
// Both clients render these; the website's Kural component and the phone's read this one list.

export interface KuralText {
  lines: readonly [string, string];
  meaning: string;
}

export const KURALS = {
  391: { lines: ["கற்க கசடறக் கற்பவை கற்றபின்", "நிற்க அதற்குத் தக."], meaning: "Learn thoroughly what you learn, then live by it." },
  396: {
    lines: ["தொட்டனைத் தூறும் மணற்கேணி மாந்தர்க்குக்", "கற்றனைத் தூறும் அறிவு."],
    meaning: "A well in sand fills as deep as you dig; knowledge grows as much as you learn.",
  },
  467: { lines: ["எண்ணித் துணிக கருமம் துணிந்தபின்", "எண்ணுவம் என்பது இழுக்கு."], meaning: "Think, then decide. Rethinking after deciding is a fault." },
  475: {
    lines: ["பீலிபெய் சாகாடும் அச்சிறும் அப்பண்டம்", "சால மிகுத்துப் பெயின்."],
    meaning: "Even a cart of peacock feathers breaks its axle if it is overloaded.",
  },
  595: {
    lines: ["வெள்ளத் தனைய மலர்நீட்டம் மாந்தர்தம்", "உள்ளத் தனையது உயர்வு."],
    meaning: "A lotus rises as high as the water; a person rises as high as their spirit.",
  },
  611: { lines: ["அருமை உடைத்தென்று அசாவாமை வேண்டும்", "பெருமை முயற்சி தரும்."], meaning: "Don't lose heart because it is hard. Effort brings greatness." },
  616: { lines: ["முயற்சி திருவினை ஆக்கும் முயற்றின்மை", "இன்மை புகுத்தி விடும்."], meaning: "Effort brings prosperity; the lack of it brings want." },
  619: { lines: ["தெய்வத்தான் ஆகா தெனினும் முயற்சிதன்", "மெய்வருத்தக் கூலி தரும்."], meaning: "Even if fate won't grant it, effort pays back the sweat you put in." },
  620: { lines: ["ஊழையும் உப்பக்கம் காண்பர் உலைவின்றித்", "தாழாது உஞற்று பவர்."], meaning: "Those who strive without tiring or slackening see even fate's back." },
  621: { lines: ["இடுக்கண் வருங்கால் நகுக அதனை", "அடுத்தூர்வது அஃதொப்ப தில்."], meaning: "When trouble comes, smile. Nothing defeats it better." },
  664: { lines: ["சொல்லுதல் யார்க்கும் எளிய அரியவாம்", "சொல்லிய வண்ணம் செயல்."], meaning: "Saying is easy for anyone. Doing what you said is the hard part." },
  666: { lines: ["எண்ணிய எண்ணியாங் கெய்துப எண்ணியார்", "திண்ணியர் ஆகப் பெறின்."], meaning: "Those who stay firm get what they set out to get, as they planned it." },
  672: { lines: ["தூங்குக தூங்கிச் செயற்பால தூங்கற்க", "தூங்காது செய்யும் வினை."], meaning: "Put off what can wait. Never put off what can't." },
} as const satisfies Record<number, KuralText>;

export type KuralNumber = keyof typeof KURALS;
