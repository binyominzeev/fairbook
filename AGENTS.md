# Fairbook Agent Guide (Implementalas + Hibajavitas)

Ez a fajl azert van, hogy az agent gyorsan talalja meg a megfelelo kodreszt uj funkciohoz vagy javitashoz, minimalis token- es idoigenynyel.

## 0) Kritikus szabaly Next.js-hez

Ez NEM a regi Next.js. Mielott kodolsz, olvasd el a relevans doksit innen:

- `node_modules/next/dist/docs/`

Figyelj a deprecaciokra es az App Router konvenciokra.

## 1) Gyors kezdolista (mindig ezzel kezdj)

1. Olvasd el a tickethez tartozo oldalt/endpointot a `src/app/` alatt.
2. Keresd meg a business logicot a `src/lib/` alatt.
3. Ellenorizd a hasznalt komponenseket a `src/components/` alatt.
4. Ha adatmodell erintett: `prisma/schema.prisma` + migrationok.
5. Valtoztatas utan legalabb celzott lint/futas.

## 2) Projekt-terkep (hol keress)

### Route-ok es oldalak

- `src/app/layout.tsx` - root layout, globalis shell
- `src/app/page.tsx` - landing + feed redirect
- `src/app/**/page.tsx` - oldal route-ok
- `src/app/api/**/route.ts` - API endpointok

### Core logika

- `src/lib/auth.ts` - session/JWT/cookie auth
- `src/lib/prisma.ts` - Prisma client singleton
- `src/lib/feed-posts.ts` - feed lekeres, pagination, filterek
- `src/lib/feed-ranking.ts` - feed score/ranking
- `src/lib/rss.ts` - RSS sync + feldolgozas
- `src/lib/notifications.ts` - notification letrehozas
- `src/lib/notification-visibility.ts` - notification lathatosagi szabalyok
- `src/lib/ai.ts` - AI moderation + cimkezes
- `src/lib/ai-prompts.ts` - prompt templatek (DB override)
- `src/lib/post-presentation.ts` - post/comment serializalas
- `src/lib/profile-activity.ts` - profil activity tabok
- `src/lib/communities.ts` - kozossegi utilok

### UI komponensek

- `src/components/FeedInfiniteList.tsx` - vegtelen feed lista
- `src/components/PostCard.tsx` - post render + post actionok
- `src/components/CommentCard.tsx` - comment render
- `src/components/CommentForm.tsx` - komment kuldes
- `src/components/CreatePostForm.tsx` - poszt letrehozas
- `src/components/PostComposerDialog.tsx` - poszt/text-card modal
- `src/components/TextCardCreator.tsx` - text-card generalas
- `src/components/NotificationsPanel.tsx` - notif lista

### Adatbazis

- `prisma/schema.prisma` - igazsag forrasa a modellekrol
- `prisma/migrations/` - migration tortenet

## 3) Hol implementalj tipikus feladatokra

### Uj oldal

- Hely: `src/app/<route>/page.tsx`
- Ha adat kell: endpoint `src/app/api/<resource>/route.ts` + lib util

### Uj API endpoint

- Hely: `src/app/api/<resource>/route.ts` vagy `src/app/api/<resource>/[id]/route.ts`
- Minta: session ellenorzes `getSession()` + validacio + prisma muvelet + JSON valasz

### Schema/model modositas

1. `prisma/schema.prisma` modositasa
2. `npx prisma migrate dev --name <nev>`
3. `npm run prisma:generate`

### Feed logika (szures/rendezes)

- Fo hely: `src/lib/feed-posts.ts`
- Ranking: `src/lib/feed-ranking.ts`
- API bekotes: `src/app/api/posts/route.ts`

### Moderacio/AI

- Szignalok es AI hivasok: `src/lib/ai.ts`
- Promptok: `src/lib/ai-prompts.ts`
- Komment/post endpointok: `src/app/api/comments/route.ts`, `src/app/api/posts/route.ts`

### Notification funkcionalitas

- Letrehozas: `src/lib/notifications.ts`
- Lathatosagi gate: `src/lib/notification-visibility.ts`
- UI: `src/app/notifications/page.tsx`, `src/components/NotificationsPanel.tsx`

### Csoportok/kozossegek

- Route-ok: `src/app/groups/`, `src/app/communities/`
- API: `src/app/api/groups/`, `src/app/api/communities/`
- Utilok: `src/lib/communities.ts`, `src/lib/feed-groups.ts`

## 4) Gyors keresesi receptek (tokensporolas)

Hasznalj `rg`-t, ne teljes fajlbeolvasast.

```bash
# Osszes API route
rg --files src/app/api | rg 'route\.ts$'

# Hol van feed logika
rg "getFeedPage|FEED_PAGE_SIZE|sort=|mode=" src/lib src/app/api/posts

# Hol jon letre notification
rg "create.*Notification|notification" src/lib src/app/api

# Moderacio pontok
rg "moderatePost|moderateComment|DiscourseSignal|moderationStatus" src/lib src/app/api

# Prisma model hasznalat
rg "prisma\.[A-Za-z0-9_]+" src/app src/lib

# Cron endpointok
rg "cron|CRON_SECRET|x-cron-secret" src/app/api src/lib
```

## 5) Fontos domain csapdak (regresszio elkerules)

- Auth cookie neve: `fairbook_token` (`src/lib/auth.ts`).
- Komment moderacio statuszok es lathatosag: publikus listakban ne szivarogjon rejtett tartalom.
- Hidden/Bookmark feed szabalyok: feed queryknel mindig ellenorizd a user-specifikus kizart elemeket.
- Notification lathatosag: komment lanc lathatosaga kotelezo ellenorzes.
- Post permalink/slug logika: `src/lib/post-permalink.ts` szerint maradjon egyedi.
- Kepfeltoltes limit: max 4 kep/post (kliens + szerver oldali gate).
- RSS cleanup: ne torolj user-interakcioval rendelkezo rekordokat.

## 6) Munkafolyamat implementalaskor

1. Celozd be az 1-2 relevans route/API fajlt.
2. Nyisd meg a hozzatartozo `src/lib/*` business logicot.
3. Csak utana modosit komponenseket/UI-t.
4. Ha schema valtozik: migration + generate ugyanabban a korben.
5. Futtass legalabb celzott lintet az erintett fajlokra.

## 7) Kesz allapot definicio (minimum)

- Implementacio megtalalhato a megfelelo route/lib/component retegekben.
- Nincs nyilvanvalo auth vagy visibility regresszio.
- Prisma valtozas eseten migration letrejott + kliens generalva.
- Erintett endpoint valasza valid es kovetkezetes.

## 8) Kieg. parancsok

```bash
npm run dev
npm run lint
npm run build
npx prisma migrate dev --name <nev>
npm run prisma:generate
```
