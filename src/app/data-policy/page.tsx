import BrandLink from "@/components/BrandLink";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import ManifestoContent from "@/components/ManifestoContent";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AboutPage() {
  const session = await getSession();
  const user = session
    ? await prisma.user.findUnique({
        where: { id: session.userId },
        select: { id: true, slug: true, name: true, email: true, avatarUrl: true },
      })
    : null;

  return (
    <>
      {user ? (
        <Navbar user={user} />
      ) : (
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
            <BrandLink href="/" size="sm" subtitle="Manifesto" />
            <Link
              href="/login"
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-950"
            >
              Sign in
            </Link>
          </div>
        </header>
      )}

      <main className="flex-1 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.16),_transparent_28%),linear-gradient(180deg,_#fffef8_0%,_#f8fafc_38%,_#f8fafc_100%)]">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mb-8 max-w-3xl space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">
              About
            </p>
            <p className="text-base leading-7 text-slate-600">
              Ez az oldal a Fairbook alapelveit foglalja össze.
            </p>
          </div>

          <hr className="my-8 border-slate-200" />

          {/* Adatvédelmi Szabályzat dokumentum törzs */}
          <article className="prose prose-slate max-w-none space-y-6 text-slate-700 leading-relaxed">
            <header className="space-y-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                FAIRBOOK
              </h1>
              <p className="text-xl font-semibold text-slate-800">
                Adatvédelmi Szabályzat
              </p>
              <p className="text-sm text-slate-500 italic">
                Hatályos: 2026. június 15-től
              </p>
            </header>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 pt-4">1. Bevezetés</h2>
              <p>
                A Fairbook (a továbbiakban: 'Platform') elkötelezett a felhasználók személyes adatainak védelme iránt. Ez az Adatvédelmi Szabályzat ismerteti, hogy milyen adatokat gyűjtünk, hogyan kezeljük azokat, és milyen jogok illetik meg a felhasználókat.
              </p>
              <p>
                A Platform üzemeltetője dr. Szántó-Várnagy Benjámin (email:{" "}
                <a href="mailto:szvbinjomin@gmail.com" className="text-amber-600 hover:underline">
                  szvbinjomin@gmail.com
                </a>
                ). A szabályzat az Európai Unió általános adatvédelmi rendeletének (GDPR – 2016/679/EU rendelet) és a vonatkozó magyar jogszabályoknak megfelelően készült.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 pt-4">2. Milyen adatokat kezelünk?</h2>
              
              <div className="space-y-2">
                <h3 className="text-md font-semibold text-slate-800">2.1 Regisztrációs adatok</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Felhasználónév</li>
                  <li>E-mail cím</li>
                  <li>Jelszó (egyirányú hash formában tárolva)</li>
                  <li>Regisztráció időpontja</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-md font-semibold text-slate-800">2.2 Felhasználói tartalmak</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Közzétett posztok és kommentek</li>
                  <li>AI-moderáció által elutasított, de a felhasználó által még nem törölt tartalmak</li>
                  <li>Megosztott vagy hivatkozott külső tartalmak</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-md font-semibold text-slate-800">2.3 Technikai adatok</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>IP-cím</li>
                  <li>Böngésző típusa és verziója</li>
                  <li>Bejelentkezések időpontja</li>
                  <li>Sütik (cookie-k) – lásd 7. pont</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-md font-semibold text-slate-800">2.4 Az AI-moderáció során keletkező adatok</h3>
                <p>
                  Az AI-moderátor minden beküldött tartalmat feldolgoz, mielőtt az megjelenne a Platformon. Az AI-moderáció által elutasított tartalmak a felhasználó számára szerkesztés vagy törlés céljából elérhetők maradnak. Az ilyen tartalmakat legfeljebb 90 napig őrizzük meg, ezt követően automatikusan törlésre kerülnek.
                </p>
                <p>
                  A Platform a tartalmak előzetes moderációjához mesterséges intelligencián alapuló szolgáltatást használ.
                </p>
                <p>
                  Az OpenAI a Platform számára adatfeldolgozói szolgáltatást nyújt. Az adattovábbítás kizárólag a moderációs szolgáltatás biztosításához szükséges mértékben történik. Az OpenAI adatkezelési gyakorlatáról további információ az OpenAI adatvédelmi tájékoztatójában érhető el.
                </p>
                <p>
                  Az OpenAI az Európai Gazdasági Térségen kívül is végezhetnek adatkezelési műveleteket. Ilyen esetben az adattovábbítás az Európai Bizottság által elfogadott megfelelő garanciák, különösen általános szerződési feltételek (Standard Contractual Clauses) alkalmazásával történik.
                </p>
                <p>
                  A Platform tervezi olyan fellebbezési lehetőség biztosítását, amelynek keretében a felhasználó emberi felülvizsgálatot kérhet az AI-moderáció döntésével kapcsolatban. A szolgáltatás keretében továbbított tartalmak nem kerülnek felhasználásra a szolgáltató nyilvános modelljeinek betanítására.
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 pt-4">3. Az adatkezelés célja és jogalapja</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>A Platform működtetése és a felhasználói fiók kezelése (jogalap: szerződés teljesítése)</li>
                <li>Biztonságos és etikus közösségi környezet fenntartása (jogalap: jogos érdek)</li>
                <li>Az AI-moderáció működtetése (jogalap: jogos érdek)</li>
                <li>Jogi kötelezettségek teljesítése (jogalap: jogi kötelezettség)</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 pt-4">4. Az adatok tárolása és megőrzése</h2>
              <p>
                A Platform tárhelyszolgáltatója az Infotipp Rendszerház Kft. (székhely: 1212 Budapest, Maros u. 32.) amely az adatok tárolásához szükséges infrastruktúrát biztosítja.
              </p>
              <p>
                A felhasználók adatait a fiók törléséig megőrizzük. A fiók törlését követően a személyes adatokat indokolatlan késedelem nélkül töröljük vagy anonimizáljuk. A biztonsági mentésekben szereplő adatok legfeljebb 60 napig maradhatnak meg, ezt követően automatikusan felülíródnak, kivéve, ha jogszabály hosszabb megőrzést ír elő.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 pt-4">5. Ki férhet hozzá az adatokhoz?</h2>
              <p>
                A felhasználók személyes adataihoz és tartalmaihoz kizárólag a Platform üzemeltetője, valamint a feladataik ellátásához szükséges mértékben az adatfeldolgozók (pl. tárhelyszolgáltató) férhetnek hozzá, kizárólag a moderációs és üzemeltetési feladatok ellátása céljából. Az adatokat harmadik félnek nem adjuk át, nem értékesítjük és nem adjuk bérbe.
              </p>
              <p className="font-medium text-slate-800">Kivételt képeznek az alábbi esetek:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Jogszabályi kötelezettség esetén (pl. hatósági megkeresés)</li>
                <li>A felhasználó kifejezett hozzájárulásával</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 pt-4">6. Kiskorú felhasználók</h2>
              <p>
                A Platform 16. életévét betöltött személyek számára használható önállóan. 16 év alatti felhasználó regisztrációjához a szülő vagy törvényes képviselő hozzájárulása szükséges.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 pt-4">7. Sütik (cookie-k)</h2>
              <p>
                A Platform kizárólag a működéshez szükséges sütiket alkalmaz (munkamenet-kezelés, bejelentkezési állapot megőrzése). Marketing- vagy nyomkövető sütiket nem használunk.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 pt-4">8. A felhasználók jogai</h2>
              <p>A GDPR alapján minden felhasználót az alábbi jogok illetnek meg:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-slate-800">Hozzáférési jog:</strong> a tárolt adatok megismerése</li>
                <li><strong className="text-slate-800">Helyesbítési jog:</strong> pontatlan adatok kijavítása</li>
                <li><strong className="text-slate-800">Törlési jog ("elfeledtetés joga"):</strong> a felhasználó kérheti személyes adatainak törlését, amennyiben annak nincs jogszabályi vagy egyéb jogszerű akadálya.</li>
                <li><strong className="text-slate-800">Adathordozhatóság joga:</strong> az adatok géppel olvasható formában való kiadása</li>
                <li><strong className="text-slate-800">Tiltakozási jog:</strong> az adatkezelés ellen való tiltakozás</li>
                <li><strong className="text-slate-800">Korlátozási jog:</strong> az adatkezelés korlátozásának kérése</li>
              </ul>
              <p>
                Jogainak gyakorlásához a felhasználó az üzemeltető e-mail-címén keresztül fordulhat hozzánk. A kérelmeket 30 napon belül teljesítjük.
              </p>
              <p>
                Az érintett panasszal fordulhat a <strong>Nemzeti Adatvédelmi és Információszabadság Hatóság</strong>-hoz (1055 Budapest, Falk Miksa utca 9–11.;{" "}
                <a href="https://www.naih.hu" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline">
                  www.naih.hu
                </a>
                ), valamint bírósághoz is fordulhat.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 pt-4">9. Adatbiztonság</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Jelszavak titkosított (hash) formában tárolva</li>
                <li>HTTPS-kapcsolat a teljes Platformon</li>
                <li>Korlátozott adminisztrátori hozzáférés</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 pt-4">10. A szabályzat módosítása</h2>
              <p>
                Fenntartjuk a jogot a jelen Adatvédelmi Szabályzat módosítására. Lényeges változás esetén a felhasználókat e-mailben értesítjük, és a módosítás hatályba lépése előtt legalább 30 nappal tájékoztatást nyújtunk.
              </p>
            </section>
          </article>
        </div>
      </main>
    </>
  );
}