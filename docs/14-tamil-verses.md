# 14 · Tamil verses: which one shows where

Written 11 Nov 2026. **Nothing here is built yet.** This file says which Thirukkural (and a few lines from other
Tamil works) appear on which screen, and how they rotate so the owner sees a different, fitting verse each time.

Today the app shows 13 kurals, one fixed kural per screen (`packages/core/src/kural.ts`, drawn by the `Kural`
component on both clients). This file widens that to 68 kurals in pools, plus 19 short lines from other works
(14 if the five marked as spares are dropped).

## 1. Owner decisions (11 Nov 2026)

- Show more kurals, each one fitting the action on the screen.
- Show a different one each time, not the same one again and again.
- Lines from other Tamil literature are welcome, but only a few. Thirukkural stays the main source.
- The list in this file is enough. No more verses are to be added in this round.

## 2. How the rotation works (requirements)

1. **A pool per moment.** Each moment in section 4 has a pool of verses. The verse the screen shows today is the first
   one listed only when nothing else decides it; otherwise it rotates.
2. **One verse per moment per day.** The same verse stays on that screen for the whole day (the app's day, from
   `todayIST()`), on both the website and the phone, so it does not change while the owner is reading it.
3. **No repeat until the pool has gone round.** A pool of five gives five different days before any verse returns.
4. **No storage and no sync.** The choice is a pure function of the moment and the date, so both devices agree
   without talking to each other. **Proposal:** `pickVerse(moment, date)` in `@tatakae/core`, using the day number
   and a fixed shuffle per round, with table-driven tests.
5. **No verse twice on one day.** If two moments would show the same verse on the same day, the second takes the next
   one in its pool.
6. **Other works are the smaller share.** Where a pool has lines from other works, they come up at most about one
   time in four.
7. **Existing placements stay.** The kural a screen shows today is listed first in its pool, so nothing the owner
   chose earlier is lost.
8. **Rare moments.** A screen seen once a week or less (weekly review, monthly review, cycle) rotates by its own
   period (week, month, cycle) and not by day.

## 3. Rules

- **One verse on a screen.** Never two.
- **Never shown:** the Morning screen, a running focus timer, Capture, Quick close, notifications, the home-screen
  widget, and any dialog that asks for a typed reason other than the ritual restart.
- **No pop-ups.** A verse is calm text on the screen, as now. It is not a toast and it does not animate.
- **Near a miss, only gentle verses.** Welcome back, a write-off day, a rest day and the "one miss" note use only the
  pools marked *gentle* in section 4. No verse about ruin, laziness or disgrace is shown there.
- **Form.** Tamil text as written, then the source, then a one-line meaning in English. The meanings in this file are
  the app's own short paraphrases, not quoted translations.
  - Kural: `திருக்குறள் 540`.
  - Other works: the work and the author, for example `ஆத்திசூடி · ஔவையார்`.
- **Settings.** One switch for showing verses at all, and one for showing the meaning under them.
- **Text must be checked before shipping.** See section 7.

## 4. Where each verse shows

"Now" is the kural the screen shows today. Verse texts are in section 5 (kurals, by number) and section 6 (other
works, by code such as A6 or B1).

### 4.1 Daily loop

| Moment | Screen and place | Now | Pool, in order | Why these fit |
|---|---|---|---|---|
| Sign in | Login screen, under the form | 619 | 619, 620, 594, 592 | Effort and a steady spirit |
| Ritual: close today | Step 1, under the heading | none | 34, 664 | Mark the day honestly |
| Ritual: small win | Step 2 | none | 667, B4, 104 | Small things carry weight |
| Ritual: what made me drift | Step 3, under the drift question | none | 540, 537, 536 | Bringing the mind back |
| Ritual: close loops | Step 4 (resume notes) | none | 674, 672 | Unfinished work |
| Ritual: capacity | Step 5, beside the capacity bar | 475 | 475, 471, 472, 473, K2 | Know your load and your strength |
| Ritual: pick missions | Step 6, above the list | none | 461, 675, 484, A60, K3 | Think, then choose |
| Ritual: P1 Minimum field | Step 6, helper line | none | 33, 673, B4 | Do what is possible, without stopping |
| Ritual: P1 obstacle line (file 12 §6.5) | Step 6, helper line | none | 676, 429 | See the obstacle before it comes |
| Ritual: P1 if-then | Step 6, helper line | none | 668 | Decided once, done without wavering |
| Ritual: shutdown complete | Step 8, final screen | 664 | 664, 661, 671 | Saying and doing |
| Ritual: restart dialog | The restart flow | 467 | 467 | Think before, not after. One verse; this dialog is rare. |
| Focus: block complete | Shown after the timer ends | 616 | 616, 594, 592, A50 | Effort pays |
| Stuck: start | Stuck sheet, before a type is picked | 611 | 611 | Do not lose heart |
| Stuck: uncertainty | After "Uncertainty" is picked | 611 | 677, 673 | Ask the one who knows; find the way that works |
| Stuck: fear | After "Fear" is picked | 611 | 669, 597, B1, B5 | Resolve under pressure |
| Stuck: inertia | After "Inertia" is picked | 611 | 668, A6 | Start without delay |
| Inbox | Top of the inbox | 672 | 672, 675 | What can wait and what cannot |
| Inbox: after a discard | The empty or just-cleared state | none | 341, K4 | Letting go |

### 4.2 After a miss, and rest (*gentle* pools)

| Moment | Screen and place | Now | Pool, in order | Why these fit |
|---|---|---|---|---|
| Welcome back | Welcome back screen | 621 | 621, 622, 623, 624, 625, B3 | Meeting trouble calmly |
| Write-off day | The write-off confirmation and that day's Today screen | none | 485, 490 | Waiting for the right time |
| Rest day | Today on a rest day | none | 486, 485, K2 | Stepping back before the next push |
| "One miss" note (file 12 §6.9) | Beside the chain | none | none | Stays quiet. Welcome back covers it. |

### 4.3 Reviews and the cycle

| Moment | Screen and place | Now | Pool, in order | Why these fit |
|---|---|---|---|---|
| Weekly review: start | Top of the review | 620 | 620, 594, 666 | Steady effort over time |
| Weekly review: Muri (overload) | Muri step | none | 473, 475, 472 | Overreach |
| Weekly review: Mura (unevenness) | Mura step | none | 540, 536 | Attention that holds |
| Weekly review: Muda (waste) | Muda step | none | 126, 341 | Holding the senses in; letting go |
| Weekly review: experiment | Experiment step | none | 461, 678 | Weigh it; let one task carry another |
| Character step: what I received (file 12 §6.6) | First field | none | 102, 104, A21 | Gratitude |
| Character step: what I gave | Second field | none | 211 | Giving without return |
| Character step: what trouble I caused | Third field | none | 316, 100 | Not causing pain; kind words |
| Character step: my part (Hansei line) | Last field | none | 436, 108 | Own fault first; forget a wrong, keep a kindness |
| Monthly review | Top of the review | 666 | 666, 661, 596 | Firmness; aiming high |
| Cycle page | Top of the page | 595 | 595, 596, 484 | The height of the spirit; the right time |
| Goal: "hell yeah" gate | Goal form, beside the gate | none | 466, 471 | What should and should not be taken on |
| New rank reached (file 12 §6.8) | The one calm line on shutdown | none | 594, 592, K1 | Energy brings growth |

### 4.4 Learning, notes and career

| Moment | Screen and place | Now | Pool, in order | Why these fit |
|---|---|---|---|---|
| Notes | Top of the notes list | 391 | 391, 392, 400, 416, 423, B7 | Learning and listening |
| Note flag "can explain" | Beside the flag in a note | none | 424, V1 | Saying a hard thing clearly |
| Japanese log | Top of the log | 396 | 396, 397, 400, A11, U1 | Learning grows with practice; every land is home to the learned |
| Applications | Top of the list | none | 648, 594 | Clear, ordered speech; steady energy |
| Interview stories | Top of the list | none | 645, 647, 648, B6 | Choosing words; speaking without fear |

### 4.5 Fitness and settings

| Moment | Screen and place | Now | Pool, in order | Why these fit |
|---|---|---|---|---|
| Fitness day | Top of the day view | 616 | 616, 619, B2 | Bodily effort pays its wage |
| Fitness: food and saved foods | Food list, when the day is at or under target | none | 942, 943, 945 | Measured eating. Never shown on a day over target. |
| Fitness: training | Training view | none | 619, B2, 597 | Strength and effort |
| Fitness: new phase | Phase form | none | 484, 471 | Right time; weigh your strength |
| Settings: wake time | Beside the wake time field | none | A107 | Rising early |

Screens with no verse, on purpose: Morning, Focus while running, Capture, Quick close, Calendar, week planner,
devices and security settings, data export.

## 5. The kurals

Thirukkural is classical Tamil in the public domain and is quoted as written. "In app" marks the 13 already in
`kural.ts`; their text and meaning there stay as they are.

### 5.1 Already in the app

| No. | Meaning in the app today |
|---|---|
| 391 | Learn thoroughly what you learn, then live by it. |
| 396 | A well in sand fills as deep as you dig; knowledge grows as much as you learn. |
| 467 | Think, then decide. (restart dialog) |
| 475 | Even a cart of peacock feathers breaks its axle if it is overloaded. |
| 595 | A lotus rises as high as the water; a person rises as high as their spirit. |
| 611 | Don't lose heart because it is hard. |
| 616 | Effort brings prosperity. |
| 619 | Even if fate won't allow it, effort pays its wage. |
| 620 | Those who strive without tiring get past even fate. |
| 621 | When trouble comes, smile. |
| 664 | Saying is easy for anyone. Doing as said is hard. |
| 666 | Those who stay firm get what they set out for. |
| 672 | Put off what can wait. Never put off what cannot. |

### 5.2 New kurals

| No. | Tamil | Meaning (own paraphrase) |
|---|---|---|
| 33 | ஒல்லும் வகையான் அறவினை ஓவாதே<br>செல்லும்வாய் எல்லாஞ் செயல். | Do the right thing in whatever way you can, without stopping, wherever there is a way. |
| 34 | மனத்துக்கண் மாசிலன் ஆதல் அனைத்தறன்<br>ஆகுல நீர பிற. | A mind without stain is the whole of virtue. The rest is noise. |
| 100 | இனிய உளவாக இன்னாத கூறல்<br>கனிஇருப்பக் காய்கவர்ந் தற்று. | Harsh words when kind ones are at hand: taking the unripe fruit while the ripe one is there. |
| 102 | காலத்தி னாற்செய்த நன்றி சிறிதெனினும்<br>ஞாலத்தின் மாணப் பெரிது. | Help given at the right time, however small, is larger than the world. |
| 104 | தினைத்துணை நன்றி செயினும் பனைத்துணையாக்<br>கொள்வர் பயன்தெரி வார். | A good turn the size of a millet seed looks as large as a palm tree to those who know its worth. |
| 108 | நன்றி மறப்பது நன்றன்று நன்றல்லது<br>அன்றே மறப்பது நன்று. | Forgetting a kindness is not good. Forgetting a wrong, the same day, is good. |
| 126 | ஒருமையுள் ஆமைபோல் ஐந்தடக்கல் ஆற்றின்<br>எழுமையும் ஏமாப் புடைத்து. | Hold the five senses in, as a tortoise draws in its limbs, and it guards you for a long time. |
| 211 | கைம்மாறு வேண்டா கடப்பாடு மாரிமாட்டு<br>என் ஆற்றுங் கொல்லோ உலகு. | Duty looks for no return. What does the world give back to the rain cloud? |
| 316 | இன்னா எனத்தான் உணர்ந்தவை துன்னாமை<br>வேண்டும் பிறன்கண் செயல். | What you know to be painful, do not do to someone else. |
| 341 | யாதனின் யாதனின் நீங்கியான் நோதல்<br>அதனின் அதனின் இலன். | Whatever you let go of, that thing can no longer hurt you. |
| 392 | எண்ணென்ப ஏனை எழுத்தென்ப இவ்விரண்டும்<br>கண்ணென்ப வாழும் உயிர்க்கு. | Numbers and letters: these two are the eyes of everyone who lives. |
| 397 | யாதானும் நாடாமால் ஊராமால் என்னொருவன்<br>சாந்துணையுங் கல்லாத வாறு. | To the learned, every country and every town is home. Why would anyone stop learning? |
| 400 | கேடில் விழுச்செல்வம் கல்வி யொருவற்கு<br>மாடல்ல மற்றை யவை. | Learning is the wealth that cannot be lost. Nothing else is wealth. |
| 416 | எனைத்தானும் நல்லவை கேட்க அனைத்தானும்<br>ஆன்ற பெருமை தரும். | Listen to something good, however little. Even that much brings worth. |
| 423 | எப்பொருள் யார்யார்வாய்க் கேட்பினும் அப்பொருள்<br>மெய்ப்பொருள் காண்ப தறிவு. | Whatever you hear, from whoever says it, wisdom is finding what is true in it. |
| 424 | எண்பொருள வாகச் செலச்சொல்லித் தான்பிறர்வாய்<br>நுண்பொருள் காண்ப தறிவு. | Wisdom is saying a hard thing so it is easy to follow, and catching the fine point in what others say. |
| 429 | எதிரதாக் காக்கும் அறிவினார்க் கில்லை<br>அதிர வருவதோர் நோய். | Those who see what is coming and guard against it meet no shock. |
| 436 | தன்குற்றம் நீக்கிப் பிறர்குற்றங் காண்கிற்பின்<br>என்குற்ற மாகும் இறைக்கு? | Clear your own fault first, then look at the faults of others. What fault is left then? |
| 461 | அழிவதூஉம் ஆவதூஉம் ஆகி வழிபயக்கும்<br>ஊதியமும் சூழ்ந்து செயல். | Before you act, weigh what it will cost, what it will bring, and what is left at the end. |
| 466 | செய்தக்க அல்ல செயக்கெடும் செய்தக்க<br>செய்யாமை யானுங் கெடும். | Doing what should not be done does harm. So does leaving undone what should be done. |
| 471 | வினைவலியும் தன்வலியும் மாற்றான் வலியும்<br>துணைவலியும் தூக்கிச் செயல். | Weigh the task, your own strength, what stands against you and who stands with you. Then act. |
| 472 | ஒல்வ தறிவது அறிந்ததன் கண்தங்கிச்<br>செல்வார்க்குச் செல்லாதது இல். | Nothing is out of reach for those who know what they can do and stay with it. |
| 473 | உடைத்தம் வலியறியார் ஊக்கத்தின் ஊக்கி<br>இடைக்கண் முரிந்தார் பலர். | Many who did not know their own strength pushed on in high spirits and broke halfway. |
| 484 | ஞாலம் கருதினுங் கைகூடுங் காலம்<br>கருதி இடத்தாற் செயின். | Even the world can be won, if you act at the right time and in the right place. |
| 485 | காலம் கருதி இருப்பர் கலங்காது<br>ஞாலம் கருது பவர். | Those who mean to win the world wait for the right time, without worry. |
| 486 | ஊக்க முடையான் ஒடுக்கம் பொருதகர்<br>தாக்கற்குப் பேருந் தகைத்து. | When a person of energy holds back, it is the ram stepping back before it charges. |
| 490 | கொக்கொக்க கூம்பும் பருவத்து மற்றதன்<br>குத்தொக்க சீர்த்த இடத்து. | Wait like the heron when it is time to wait. Strike like the heron when the moment comes. |
| 536 | இழுக்காமை யார்மாட்டும் என்றும் வழுக்காமை<br>வாயின் அதுவொப்பது இல். | Nothing compares with a mind that stays attentive, toward everyone and at all times. |
| 537 | அரியஎன்று ஆகாத இல்லைபொச் சாவாக்<br>கருவியால் போற்றிச் செயின். | Nothing is too hard when it is done with care and a mind that does not wander. |
| 540 | உள்ளியது எய்தல் எளிதுமன் மற்றுந்தான்<br>உள்ளியது உள்ளப் பெறின். | What you aim at is easy to reach, if you keep bringing your mind back to it. |
| 592 | உள்ளம் உடைமை உடைமை பொருளுடைமை<br>நில்லாது நீங்கி விடும். | A strong heart is the real wealth. Material wealth does not stay. |
| 594 | ஆக்கம் அதர்வினாய்ச் செல்லும் அசைவிலா<br>ஊக்க முடையா னுழை. | Good fortune asks the way and goes to the one whose energy does not waver. |
| 596 | உள்ளுவ தெல்லாம் உயர்வுள்ளல் மற்றது<br>தள்ளினுந் தள்ளாமை நீர்த்து. | Let every thought aim high. Even if you fall short, the aim stays with you. |
| 597 | சிதைவிடத்து ஒல்கார் உரவோர் புதையம்பிற்<br>பட்டுப்பா டூன்றுங் களிறு. | The strong do not give way when things fall apart: the elephant stands firm under a rain of arrows. |
| 622 | வெள்ளத் தனைய இடும்பை அறிவுடையான்<br>உள்ளத்தின் உள்ளக் கெடும். | A flood of trouble fades when a wise person thinks it through. |
| 623 | இடும்பைக்கு இடும்பை படுப்பர் இடும்பைக்கு<br>இடும்பை படாஅ தவர். | Those who do not grieve at trouble give trouble to trouble itself. |
| 624 | மடுத்தவா யெல்லாம் பகடன்னான் உற்ற<br>இடுக்கண் இடர்ப்பாடு உடைத்து. | Like the ox that pulls through every hard patch, the one who keeps going leaves trouble in trouble. |
| 625 | அடுக்கி வரினும் அழிவிலான் உற்ற<br>இடுக்கண் இடுக்கட் படும். | Even when troubles come in rows, they are the ones troubled by a person who does not give in. |
| 645 | சொல்லுக சொல்லைப் பிறிதோர்சொல் அச்சொல்லை<br>வெல்லுஞ்சொல் இன்மை அறிந்து. | Say your word once you know that no other word can better it. |
| 647 | சொலல்வல்லன் சோர்விலன் அஞ்சான் அவனை<br>இகல்வெல்லல் யார்க்கும் அரிது. | Hard to defeat: one who speaks well, does not tire and does not fear. |
| 648 | விரைந்து தொழில்கேட்கும் ஞாலம் நிரந்தினிது<br>சொல்லுதல் வல்லார்ப் பெறின். | The world is quick to act for those who can lay things out in order and say them pleasantly. |
| 661 | வினைத்திட்பம் என்பது ஒருவன் மனத்திட்பம்<br>மற்றைய எல்லாம் பிற. | Firmness in action is firmness of mind. Everything else is something other. |
| 667 | உருவுகண்டு எள்ளாமை வேண்டும் உருள்பெருந்தேர்க்கு<br>அச்சாணி அன்னார் உடைத்து. | Do not look down on something for its size. A great chariot rolls on a small linchpin. |
| 668 | கலங்காது கண்ட வினைக்கண் துளங்காது<br>தூக்கங் கடிந்து செயல். | What you decided with a clear head, do without wavering and without delay. |
| 669 | துன்பம் உறவரினும் செய்க துணிவாற்றி<br>இன்பம் பயக்கும் வினை. | Even if it hurts at first, do with resolve the work that ends in good. |
| 671 | சூழ்ச்சி முடிவு துணிவெய்தல் அத்துணிவு<br>தாழ்ச்சியுள் தங்குதல் தீது. | Thinking ends in a decision. Leaving that decision to sit is the harm. |
| 673 | ஒல்லும்வா யெல்லாம் வினைநன்றே ஒல்லாக்கால்<br>செல்லும்வாய் நோக்கிச் செயல். | Where the direct way is open, take it. Where it is not, find the way that works. |
| 674 | வினைபகை என்றிரண்டின் எச்சம் நினையுங்கால்<br>தீயெச்சம் போலத் தெறும். | Work left half done is like a fire left half out: it comes back. |
| 675 | பொருள்கருவி காலம் வினையிடனொடு ஐந்தும்<br>இருள்தீர எண்ணிச் செயல். | Resources, tools, time, the task and the place: think these five through, then act. |
| 676 | முடிவும் இடையூறும் முற்றியாங்கு எய்தும்<br>படுபயனும் பார்த்துச் செயல். | Look at the finish, the obstacles and the gain at the end. Then act. |
| 677 | செய்வினை செய்வான் செயன்முறை அவ்வினை<br>உள்ளறிவான் உள்ளம் கொளல். | The way to do a task: learn the mind of someone who knows it from the inside. |
| 678 | வினையான் வினையாக்கிக் கோடல் நனைகவுள்<br>யானையால் யானையாத் தற்று. | Let one task carry the next, as one elephant is used to catch another. |
| 942 | மருந்தென வேண்டாவாம் யாக்கைக்கு அருந்தியது<br>அற்றது போற்றி உணின். | The body needs no medicine if you eat only after the last meal has been digested. |
| 943 | அற்றால் அறவறிந்து உண்க அஃதுடம்பு<br>பெற்றான் நெடிதுய்க்கும் ஆறு. | Once the last meal is digested, eat in known measure. That is how the body is kept for long. |
| 945 | மாறுபாடு இல்லாத உண்டி மறுத்துண்ணின்<br>ஊறுபாடு இல்லை உயிர்க்கு. | Eat food that suits you, with restraint, and no harm comes to your life. |

## 6. Lines from other Tamil works

Nineteen lines, all short. The authors are long dead and the works are in the public domain (Bharathiyar died in
1921, and his works were made public property by the Tamil Nadu government).

| Code | Work and author | Tamil | Meaning (own paraphrase) |
|---|---|---|---|
| A6 | ஆத்திசூடி · ஔவையார் | ஊக்கமது கைவிடேல் | Do not let go of your drive. |
| A11 | ஆத்திசூடி · ஔவையார் | ஓதுவது ஒழியேல் | Do not stop studying. |
| A21 | ஆத்திசூடி · ஔவையார் | நன்றி மறவேல் | Do not forget a kindness. |
| A50 | ஆத்திசூடி · ஔவையார் | செய்வன திருந்தச் செய் | What you do, do well. |
| A60 | ஆத்திசூடி · ஔவையார் | தூக்கி வினை செய் | Weigh it, then act. |
| A107 | ஆத்திசூடி · ஔவையார் | வைகறைத் துயில் எழு | Rise before dawn. |
| K1 | கொன்றை வேந்தன் · ஔவையார் | ஊக்கம் உடைமை ஆக்கத்திற்கு அழகு. | Drive is what makes growth good. |
| K2 | கொன்றை வேந்தன் · ஔவையார் | பையச் சென்றால், வையம் தாங்கும். | Go gently and the earth will carry you. |
| K3 | கொன்றை வேந்தன் · ஔவையார் | நுண்ணிய கருமமும் எண்ணித் துணி. | Even for a small task: think, then decide. |
| K4 | கொன்றை வேந்தன் · ஔவையார் | கிட்டாதாயின் வெட்டென மற. | If it cannot be had, drop it at once. |
| B1 | புதிய ஆத்திசூடி · பாரதியார் | அச்சந் தவிர். | Put fear aside. |
| B2 | புதிய ஆத்திசூடி · பாரதியார் | உடலினை உறுதிசெய். | Make the body strong. |
| B3 | புதிய ஆத்திசூடி · பாரதியார் | தோல்வியிற் கலங்கேல். | Do not be shaken by a loss. |
| B4 | புதிய ஆத்திசூடி · பாரதியார் | லவம் பல வெள்ளமாம். | Many drops make a flood. |
| B5 | புதிய ஆத்திசூடி · பாரதியார் | செய்வது துணிந்து செய். | What you do, do boldly. |
| B6 | புதிய ஆத்திசூடி · பாரதியார் | சொல்வது தெளிந்துசொல். | Say it clearly. |
| B7 | புதிய ஆத்திசூடி · பாரதியார் | கற்ற தொழுகு. | Live what you have learned. |
| U1 | உலகநீதி · உலகநாதர் | ஓதாமல் ஒருநாளும் இருக்க வேண்டாம் | Let no day pass without study. |
| V1 | வெற்றிவேற்கை · அதிவீரராம பாண்டியர் | கல்விக்கு அழகு கசடு அற மொழிதல். | Learning shows in saying it without error. |

The table has 19 rows; five are spares. The planner may drop any five to keep to the owner's "a few" (suggested
spares: A50, K3, B5, B7, V1).

## 7. Text checks before shipping

- **Source used for the kurals:** a public dataset of all 1,330 kurals (link in section 9). It has a few typing
  errors: kurals 483, 599 and 784 contain a wrong character there. None of the three is used in this file.
- **Spelling varies between editions.** The app's own text for 475 and 666 differs slightly from the dataset
  (joined and split words). This is normal for Thirukkural. Each new kural must be compared with one printed or
  scholarly edition (for example Project Madurai or Tamil Virtual Academy) before it goes into `kural.ts`.
- **Other works** were read from Tamil Wikisource on 11 Nov 2026. Bharathiyar's lines are printed there with joined
  words (for example அச்சந் தவிர்); keep the printed form.
- **The owner reads Tamil and should read every new verse once** before release. The English meanings are short
  paraphrases written for this app and may miss a shade of meaning; kurals 126, 397, 596 and 624 are the loosest.
- A core test should check that every verse named in a pool exists in the list, and that no excluded verse
  (section 8) is in any pool.

## 8. Verses left out on purpose

| Verse | Why |
|---|---|
| Kural 618 | Already excluded: reads as blame next to a miss. |
| Kurals 601 to 610 (the chapter on idleness), 605 and 612 in particular | They speak of ruin and disgrace through laziness. The app never blames. |
| Kurals 435, 476, 479 | Images of ruin (straw before fire, falling from the branch). Too heavy beside a plan. |
| Kural 334 | Time as a saw cutting through life. Fits "waste", but reads as guilt. |
| Kural 293 | "Your own heart will burn you." Fits honest marking, but reads as guilt. |
| Kurals 946 and 947 | Illness for those who overeat. Would read as blame on a day over the calorie target. |
| Kural 600 | Calls people without energy "trees in human form". |
| Lines in Aathichoodi, Kondrai Vendhan and Vetriverkai about women, caste or kings | Not fitting for this app. Only the lines in section 6 are used. |

## 9. Changes this needs in other files (when built)

| File | Change |
|---|---|
| `packages/core/src/kural.ts` | Becomes the full verse list (kurals and other works), the pools per moment, and `pickVerse`. Tests for rotation and for the rules in sections 2 and 3. |
| `Kural` component (website and phone) | Takes a moment, not a fixed number; shows the source line for other works. |
| `docs/05-ui-ux.md` (Copy section) | Replace the fixed list of kurals per screen with a pointer to this file. |
| The owner's standing rule "Thirukkural only" | Now reads: Thirukkural first, plus the few lines from other Tamil works listed here. Still no references to shows, films or anime, and no pictures. |

Sources:
- Thirukkural dataset used for text: https://github.com/tk120404/thirukkural
- ஆத்திசூடி (Tamil Wikisource): https://ta.wikisource.org/wiki/ஆத்திசூடி
- புதிய ஆத்திசூடி (Tamil Wikisource): https://ta.wikisource.org/wiki/புதிய_ஆத்திசூடி
- கொன்றை வேந்தன் and வெற்றிவேற்கை, in நீதிக் களஞ்சியம் (Tamil Wikisource): https://ta.wikisource.org/wiki/நீதிக்_களஞ்சியம்
- உலகநீதி (Tamil Wikisource): https://ta.wikisource.org/wiki/உலகநீதி
