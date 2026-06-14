interface ManifestoContentProps {
  compact?: boolean;
  showSummary?: boolean;
}

const manifestoParagraphs = [
  "A Fairbook azoknak szól, akik felismerték a közösségi média jelenlegi formájának problémáit: az algoritmusok a felháborodást jutalmazzák, a gyűlölet terjed, a félretájékoztatás gyorsabban kering, mint a valóság. Mindez különösen súlyos következményekkel járt a zsidó közösség számára – de nem csak számára.",
  "A Fairbook más utat választ. Minden poszt és komment az AI-moderátor szűrőjén megy át, mielőtt megjelenik. Ez nem cenzúra – ahogyan egy zsinagógában, egy étteremben vagy egy szerkesztőségben is más normák érvényesek, mint a nyílt utcán. Aki ide regisztrál, tudatosan választ egy minőségibb teret, és vállalja ennek feltételeit.",
  <>
    A platform értékrendje a zsidó hagyomány két alapelvén nyugszik, amelyek
    azonban egyetemes érvényűek. A <em>láson hárá</em> – a romboló beszéd
    tilalma – és az <em>onáát devárim</em> – a szóbeli bántalmazás tilalma –
    évezredek óta azt tanítják, hogy a szavaknak súlyuk van, és felelősség
    terheli azt, aki kimondja őket. A Fairbook ezt az ősi bölcsességet
    alkalmazza a digitális térre.
  </>,
  "A tiltott tartalmak köre egyértelmű: gyűlöletbeszéd, megvető megfogalmazás, verbális abúzus, félretájékoztatás, gyorsan ellenőrizhető faktikus tévedések, valamint szelektív torzítással uszító narratívák – amelyekben igaz elemek szándékosan hamis összképet alkotnak. Izrael politikájának kritikája nem tiltott. Az uszítás igen.",
  "A pre-moderáció nevelő jellegű is. Mielőtt egy üzenet megjelenik, a felhasználónak – akár tudatosan, akár nem – szembe kell néznie a kérdéssel: valóban ezt akarom mondani, és így akarom mondani? Ez a megállás maga is érték.",
  "A technológia okozta sebeket a technológia is gyógyíthatja – ha értékek irányítják. A Fairbook erre tesz kísérletet.",
  <>
    <em>Csatlakozz, ha számodra is fontosabb a tisztesség, mint a korlátlan visszhang.</em>
  </>
];

export default function ManifestoContent({
  compact = false,
  showSummary = true,
}: ManifestoContentProps) {
  return (
    <article
      className={`rounded-[2rem] border border-slate-200 bg-white/90 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm ${
        compact ? "p-6 sm:p-8" : "p-8 sm:p-12"
      }`}
    >
      <div className="max-w-3xl space-y-8">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-700">
            FAIRBOOK
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Egy tisztességes tér.
          </h1>
          {showSummary && (
            <p className="max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">
              Egy olyan közösségi közeg, ahol a vita minősége fontosabb, mint a zaj,
              és ahol a részvétel tudatos vállalás.
            </p>
          )}
        </div>

        <div className="h-px w-full bg-gradient-to-r from-amber-200 via-slate-200 to-transparent" />

        <div className="space-y-6 text-base leading-8 text-slate-700 sm:text-[1.075rem] sm:leading-9">
          {manifestoParagraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </div>
    </article>
  );
}