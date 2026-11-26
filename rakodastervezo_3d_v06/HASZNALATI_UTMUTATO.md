# Rakománytervező 3D V06 – használati útmutató

## Indítás
Indítsd el a helyi szervert (`py -m http.server 8136 --directory rakodastervezo_3d_v06`), majd nyisd meg a <http://localhost:8136/> címet.
GitHub Pages-en a `…/rakodastervezo_3d_v06/` címen érhető el. Fájlból megnyitva is működik, de ilyenkor az optimalizálás a fő szálon fut.

## 1. Jármű (bal panel, ⓪)
Válassz járműtípust:
- Standard, Mega vagy Semi-mega félpótkocsi;
- Jumbo – motorkocsi vagy pótkocsi raktér;
- dobozos teherautó, kisteherautó, egyedi.

A belső méretek és a hasznos teher automatikusan kitöltődnek, és kézzel módosíthatók. **Az értékek tájékoztató jellegűek.** A Jumbo két raktérét külön tervként tervezd meg.

## 2. Rakomány bevitele (①)
A mezők kötelező sorrendje:
1. darabszám,
2. hosszúság,
3. szélesség,
4. magasság (cm),
5. súly (kg/db, egységsúly),
6. halmozhatóság.

A halmozhatóság lehetséges értékei:
- **Nem halmozható:** semmi sem kerülhet rá, és ő maga csak a padlón állhat.
- **Semmi nem helyezhető a tetejére:** állhat más egységen, de rá semmi.
- **Maximum 2 / 3 / 4 szint, egyedi:** a szintszámba a legalsó egység is beleszámít, és az oszlopban a legszigorúbb tag korlátja dönt.

**Max. felső terhelhetőség:** az egység fölött álló összes súly felső határa. Üresen hagyva „ismeretlen”: ilyenkor az optimalizáló nem tesz rá semmit.

Az „Opcionális adatok” alatt megadható:
- megnevezés,
- rakományazonosító (üresen: T01, T02…),
- lerakóhely (1 = elsőként lerakott, az ajtóhoz legközelebb),
- típus,
- szín,
- elforgathatóság.

A tételpanel alatt az **egységsúly** és az **össztömeg** külön jelenik meg. A „＋ Tétel hozzáadása” gomb a megadott darabszámú egységet a jobb oldali **várakozóba** teszi.

## 3. Kézi elhelyezés (3D nézet)

| Művelet | Vezérlés |
|---|---|
| Kijelölt várakozó egység elhelyezése | bal kattintás a padlóra vagy egy halmozható egység tetejére |
| Behúzás a várakozóból | bal gombbal húzd a jobb oldali listából |
| Áthelyezés, egymásra helyezés | bal húzás |
| Forgatás 90°-kal | R vagy görgő (kijelölt egységen) |
| Pontos léptetés | nyilak: 1 cm · Shift + nyilak: 10 cm |
| Kamera forgatása | jobb gombos húzás (vagy Shift + bal húzás) |
| Nagyítás | Shift + görgő |
| Visszavonás / újra | Ctrl+Z / Ctrl+Y vagy a felső sáv gombjai |

- **Zöld előnézet:** érvényes pozíció. **Piros:** érvénytelen (ütközés, kilógás, tiltott halmozás, nincs teljes alátámasztás, szint- vagy terhelési korlát). Érvénytelen helyre a rakomány nem kerül le.
- **Illesztés (⌖):** rácslépés 1 / 5 / 10 cm vagy szabad mozgatás. A mágneses illesztés falhoz és szomszédos rakományhoz igazít, a küszöb állítható (alapérték 10 cm).
- **Jobb panel (②, ③):** pontos X / Y / Z (cm a homlokfaltól, a bal faltól és a padlótól), forgatás, lerakóhely, méretek, szín, azonosító, halmozhatóság, súly, szintszám, terhelhetőség és forgathatóság. Minden módosítás előtt ellenőrzés fut, érvénytelen módosítás nem véglegesül.

## 4. Automatikus optimalizálás
1. Válaszd ki az üzemmódot a ⚙ panelen. Az időkorlát és a seed állítható.
   - **Gyors** (1 s): napi ajánlatkészítéshez;
   - **Intelligens** (5 s): több sorrend és forgatás;
   - **Maximális helykihasználás** (30 s): a legtöbb iteráció.
2. Kattints a felső sáv **⚙ Optimalizálás** gombjára. A futás bármikor megszakítható a **■ Megszakítás** gombbal; ilyenkor az addigi legjobb érvényes eredmény marad meg.
3. Az eredmény az **„Optimalizálási eredmény – A / B / C terv”** táblázatba kerül, az A terv automatikusan a munkaterületre töltődik. Másik tervet az „Alkalmaz” gombbal tölthetsz be.
   - **A terv:** a legkisebb fizikai helyigény.
   - **B terv:** a legnagyobb összefüggő szabad tér; gyakran azonos az A tervvel.
   - **C terv:** lerakodási sorrend. Csak akkor készül el, ha minden egységnek van lerakóhelye.
4. Ha nem fér el minden egység, a terv **„RÉSZLEGES – nem teljes rakományterv”** jelölést kap, és a kimaradt egységek okkal együtt látszanak:
   - `NEM_FER_BE`: méret miatt nem fér el;
   - `HASZNOS_TEHER_TULLEPES`: a hasznos teher miatt nem fér el;
   - `NINCS_SZABAD_HELY`: nem talált érvényes szabad helyet.

Az eredmény heurisztikus keresésből származik („a talált legjobb terv”), nem igazolt optimum. A becsült alsó korlát azt mutatja, mekkora a távolság a talált tervtől.

## 5. Mutatók (alsó állapotsáv és elemzés)
- **Fizikai helyigény:** a homlokfaltól a legtávolabbi rakománypontig mért hossz (m).
- **Elméleti LDM:** Σ alapterület ÷ referenciaszélesség (alapérték 2,40 m, a ⚙ panelen állítható). Zárójelben a halmozással korrigált érték.
- **Díjszámítási LDM:** a FuvarDíj 4.0 szabálya szerint számolva (kg/LDM, szabály, kerekítés).
- **Egyéb:** össztömeg / hasznos teher, szabad kapacitás (kg és m³), padló- és térfogat-kihasználtság, a terv állapota.

A fizikai helyigény és az elméleti LDM **nem azonos díjszámítási alap**.

## 6. Szabad helyek
A nézet feletti **„Szabad helyek”** kapcsoló áttetsző kékkel mutatja az összefüggő szabad térrészeket. A jobb panel listájából egy térrészt kijelölve megjelenik:
- a mérete és a térfogata;
- a padlóterülete (ha a padlón van);
- hogy mely tételek egysége fér bele méret szerint.

A felsorolt térrészek nem fedik egymást.

## 7. Mentés, betöltés, export
- **⇩ Mentés:** teljes, szerkeszthető V06 JSON.
- **⇧ Betöltés:** V06 vagy V03–V05 terv, tervgyűjtemény, fuvardíjkalkulátor-export.
- **⤓ Exportálás:**
  - PNG: 3D nézet;
  - PNG: 2D felülnézet;
  - PDF: nyomtatási nézet, a böngészőben válaszd a „Mentés PDF-ként” célt;
  - fuvardíjkalkulátor-adatcsomag (lásd: INTEGRACIO.md).
- **Tervek összehasonlítása** (lent): több változat menthető, megnyitható, exportálható. A FuvarDíj 4.0 adatcsomag változatlan.

> A geometriai és halmozási ellenőrzés nem igazolt rakományrögzítési vagy közlekedésbiztonsági minősítés.
