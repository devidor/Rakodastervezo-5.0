# Rakománytervező 3D V06 – tesztjelentés

Készült: 2026-11-26. Ez a jelentés csak a ténylegesen lefuttatott ellenőrzéseket tartalmazza.

Környezet: Windows 11, Node v24.18.1, Python (py launcher) + pytest, Intel Core i5-8250U, a Claude desktop alkalmazás beépített böngészője (Chromium), `py -m http.server 8136`.

## 1. Automatizált tesztek – összesítés

| Csomag | Parancs | Eredmény |
|---|---|---|
| V05 LDM-modul (változatlan) | `node --test tests/ldm_modul.test.js` | **30/30 sikeres** |
| V06 modulok és kötelező esetek | `node --test tests/v06.test.js` | **32/32 sikeres** |
| FuvarDíj 4.0-paritás (V05 adapter, változatlan) | `py -m pytest tests` (`FUVARDIJ4_PATH`: `fuvar-kalkulator` `origin/feature/fuvardij-4`, `git archive`-val kicsomagolt, csak olvasott példány) | **869/869 sikeres** |

A kiinduló V05-példányon a módosítások előtt is lefutott: 30/30 és 869/869 sikeres.

## 2. Kötelező tesztesetek

| # | Eset | Automatizált (Node) | Böngészőben (V06 felület) | Mért eredmény |
|---|---|---|---|---|
| 1 | 10 db 120×80×100, 300 kg, nem halmozható | ✅ | – | Össztömeg 3000 kg, elméleti LDM 4,00, fizikai helyigény 4,00 m, ütközésmentes, „Érvényes” |
| 2 | 12 db 120×80×80, 250 kg, max. 3 szint, 600 kg | ✅ | ✅ (tételbevitel + gyors optimalizálás Web Workerben) | 3000 kg; 4 db 3 szintes oszlop, 240 cm; alsó egység terhelése 500 kg ≤ 600; korrigált LDM 1,60; fizikai 1,60 m. Kiegészítő esetek: 200 kg terhelhetőségnél nincs halmozás, 300 kg-nál legfeljebb 2 szint (160 cm). |
| 3 | Vegyes: 6×120×80×100/350 kg (max. 2 szint, 400 kg) · 4×100×100×120/450 kg (nem halmozható) · 3×150×70×80/200 kg (semmi a tetejére) | ✅ | ✅ (intelligens mód, lerakóhelyekkel) | 4500 kg, 13/13 elhelyezve, ütközésmentes. Csak a raklapok kerültek egymásra, forgatott elhelyezés is van. Fizikai helyigény 4,70 m (seed 42) és 4,50 m (felület, seed 20261126). |
| 4 | 1 db 300×260×200, 1000 kg, vízszintesen forgatható | ✅ | ✅ | `NEM_FER_BE`: „semmilyen megengedett orientációban nem fér be a 1360 × 245 × 270 cm-es rakodótérbe”; állapot: RÉSZLEGES |
| 5 | 4 db 120×80×100, 400 kg, semmi a tetejére | ✅ (kézi szabály + optimalizáló) | ✅ (rátétel húzással „nem halmozható” egységre: piros, elutasítva) | Az optimalizáló minden egységet a padlóra tesz. Kézzel ráhelyezve: `NEM_HALMOZHATO` hiba, a kézi elhelyezés blokkolva. |
| 6 | 4 db 120×100×100, 300 kg, nem halmozható | ✅ | – | Fizikai helyigény **2,00 m**, mind a 4 egység 90°-ban |
| 7 | 30 × 1000 kg, 24 000 kg hasznos teher | ✅ | ✅ | „Az össztömeg (30 000 kg) meghaladja … nem teljesíthető”. 24 elhelyezve, 6 kimaradt `HASZNOS_TEHER_TULLEPES` okkal; állapot: RÉSZLEGES |
| 8 | Két egység részben egymásba (kézi) | ✅ (logika) | ✅ (egérhúzás pointer-eseményekkel) | Piros áttetsző előnézet, „🔴 Ütközés: T03-01 (#16) és T03-02 (#17)”. Elengedés után a pozíció változatlan (X 425, Y 16), a hibás elhelyezés nem véglegesült. |
| 9 | Összetett terv mentése és visszatöltése | ✅ (19 mező egységenként bitre azonos) | ✅ (mentés → új terv → betöltés fájlválasztóval → újramentés) | A két mentett fájl `boxes`, `trailer` és `beallitasok` része bitre azonos (13 egység: koordináták, méretek, színek, forgatás, halmozási szabályok, lerakó) |
| 10 | V05-regresszió | ✅ (V05-tesztek, V05-minták betöltése) | ✅ (lásd 3. pont) | Részletek: `V05_FUNKCIOLELTAR.md` |

További automatizált tesztek:
- geometria: érintkezés vagy ütközés, forgatás, térbeli index, rács- és mágneses illesztés;
- határok mind a 3 tengelyen;
- oszlopszint-korlát, ismeretlen terhelhetőség („Nem ellenőrzött”), forgatási tilalom, lerakodási sorrend;
- a C terv csak lerakóhelyekkel készül, és a sorrendet betartja;
- reprodukálhatóság (azonos seed → azonos terv), megszakítás;
- 15 véletlen vegyes rakomány: az A és B terv mindig érvényes;
- referenciaszélesség;
- szabad terek: átfedésmentes felbontás, pontos szabad térfogat, javaslat;
- V05 egyedi mentés visszaalakítása páratlan szélességnél;
- integrációs séma;
- hibás fájlok elutasítása.

## 3. Böngészős ellenőrzés (V06, http://localhost:8136)

- **Betöltés:** konzolhiba nélkül tölt be. Az egyetlen észlelt hibát (`$` a definíciója előtt használva) a fejlesztés közben javítottam, utána újratöltve nem jelentkezett.
- **Optimalizálás:**
  - Web Workerben fut (hálózati napló: `GET /optimalizalo_worker.js`);
  - fő szálas tartalék a Worker letiltásával: 120 egység, maximális mód, megszakítás 1,5 s után;
  - a felület közben válaszkész maradt: a legnagyobb mért időzítő-késés 76 ms volt;
  - megszakítás után megmaradt a legjobb eredmény („MEGSZAKÍTVA”), részleges jelöléssel.
- **A/B/C táblázat:** a C terv csak lerakóhelyekkel készül, egyébként indoklással kimarad. Az „Alkalmaz” gomb működik.
- **Szabad helyek:** a kapcsoló, a 3D-kiemelés, a lista és a részletek működnek. Példa: SZ01 910×245×270 cm, 60,197 m³, padló 22,30 m², a várakozó tételekre adott javaslattal.
- **Export** (a letöltést a böngészőben elfogtuk, így fájl nem került a gépre):
  - PNG 3D: 56 895 bájt;
  - PNG 2D felülnézet: 35 349 bájt;
  - fuvardíjkalkulátor-export: sémahiba nincs, `arazas: null`;
  - PDF nyomtatási nézet: 7 fejezet, 3 kép, dátum és programverzió; a `window.print()` hívás megtörtént.
- **Betöltés:** a `mintaterv_3_reteg.json` (V04) „Érvényes figyelmeztetésekkel” állapotban, a `mintatervek_3_valtozat.json` (V05-gyűjtemény) 3 tervvel, mind „Megfelel”.
- **V05-vezérlések:**
  - nyíl: 1 cm, Shift + nyíl: 10 cm;
  - R és görgő: forgatás; Ctrl+Z visszavonás;
  - Shift + görgő: nagyítás (109%);
  - méretcsúszka, szín, azonosító;
  - visszavitel a várakozóba, törlés;
  - terv mentése új tervként, megnyitás, törlés; FuvarDíj 4.0 csomag (`fuvardij4-rakodasi-csomag`, ár nélkül);
  - súgópanel, kamera-nézetek, járműváltás (a nem férő elrendezésnél elutasítja, a V05-tel azonosan).
- **Nem ellenőrizhető:**
  - *teljes képernyő*: a beépített böngésző sem a V05-ben, sem a V06-ban nem váltott teljes képernyőre (a kód változatlan);
  - *behúzás a várakozóból HTML5 drag & drop-pal*: a kód változatlan, valódi húzással nem teszteltük;
  - *`file://` megnyitás*: a beépített böngésző statikus másolatként nyitja meg; a tartalékot a Worker letiltásával teszteltük.

## 4. Teljesítmény (mért, `tests/teljesitmeny_eredmeny.txt`)

Node v24.18.1, i5-8250U. A böngészős futás ettől eltérhet. Kiemelt értékek (teljes táblázat a fájlban):

| Egység | Rakomány | Gyors | Intelligens | Maximális | Elhelyezett | Helyigény (gyors → max.) | Alsó korlát |
|---|---|---|---|---|---|---|---|
| 10 | vegyes | 0,009 s | 0,053 s | 0,359 s | 10/10 | 2,30 → 2,30 m | 1,80 m |
| 50 | vegyes | 0,018 s | 0,350 s | 4,367 s | 50/50 | 13,20 → 12,70 m | 12,25 m |
| 100 | vegyes (nem fér el) | 0,028 s | 1,331 s | 16,692 s | 74 → 89/100 | 13,60 → 13,40 m | – |
| 200 | vegyes (nem fér el) | 0,501 s | 5,028 s (időkorlát) | 30,030 s (időkorlát) | 172 → 174/200 | 13,50 → 13,30 m | – |
| 50 | halmozható kartonok | 0,023 s | 1,121 s | 7,743 s | 50/50 | 2,80 → 2,80 m | 2,26 m |
| 100 | halmozható kartonok | 0,059 s | 1,664 s | 21,773 s | 100/100 | 5,40 → 5,20 m | 4,57 m |
| 200 | halmozható kartonok | 0,194 s | 5,018 s (időkorlát) | 30,020 s (időkorlát) | 200/200 | 10,80 → 10,60 m | 9,16 m |

- Minden mért terv átment a teljes érvényesség-ellenőrzésen.
- Egy greedy menet 200 egységnél 66–154 ms volt, ugyanazon a gépen, két futás között.
- A teljes ellenőrzés legfeljebb 2,6 ms, a szabadtér-elemzés legfeljebb 17,5 ms.
- Az alsó korlát becslés, nem elérhető érték. A „determinisztikus kész” címke az intelligens és a maximális módban, kis esetszámnál azt jelenti, hogy a keresés az alsó korlát elérése miatt állt le.

## 5. Ismert korlátozások

- Az optimalizáló heurisztikus: nem garantál optimumot. Vegyes, nagyrészt nem halmozható rakománynál a talált hossz 0–20%-kal haladhatja meg a becsült alsó korlátot (a mért esetekben).
- A B terv sok esetben azonos az A tervvel; ezt a táblázat jelzi.
- Csak vízszintes (0°/90°) forgatás van. A „minden irányban forgatható” opció nem készült el.
- A Jumbo két önálló raktérsablon, közös, két raktérre osztó optimalizálás nincs.
- Alátámasztás: csak teljes, egyetlen alsó egységen. A több egységen átívelő alátámasztás nem támogatott (konzervatív szabály).
- Nem ellenőrzött: tengelyterhelés, súlypont, rakományrögzítés, dinamikus terhelés (lásd a felület „Nem ellenőrzött” listáját).
