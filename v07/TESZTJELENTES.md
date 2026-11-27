# Rakománytervező 3D V07 – tesztjelentés

Dátum: 2026-11-26. Környezet: Windows 11, Node 24.18.1, Python 3 (pytest), a Claude desktop beépített (Chromium) böngészője, helyi szerver a repó gyökeréből (`py -m http.server 8137`).

## 1. Automatizált tesztek

| Csomag | Eredmény |
|---|---|
| `node --test tests/` (V05 LDM + V06 + V07) | **90 / 90 sikeres** (ebből 28 V07-teszt, ebből 5 a 0.7.1-es szétosztásé) |
| FuvarDíj 4.0-paritás (`py -m pytest tests`, `FUVARDIJ4_PATH`) | **869 / 869 sikeres** |

A V06 62 tesztje a `v07/` alatt változatlanul fut. A V06-os ellenőrző és optimalizáló alapértelmezésben a V06-szabályokat adja; a V07-szabályokat a `biztonsag.js` és az `optimalizalo_profi.js` adja.

## 2. Kötelező tesztesetek (a fejlesztési prompt 9. pontja)

| # | Eset | Eredmény |
|---|---|---|
| 1 | Nehéz doboz törékenyre | `TOREKENY_HALMOZAS`. Az optimalizáló A/B/C terve sem tesz ilyet. ✓ |
| 2 | Minden rakomány a homlokfalnál | `TENGELYTERHELES` (első és hajtott tengely) és `SULYPONT_HOSSZ`. Az értékek a kézi emelőszabállyal ±1%-on belül egyeznek. ✓ |
| 3 | Egy oldalra pakolt nehéz rakomány | `SULYPONT_KERESZT`. Az optimalizáló kiegyenlíti. ✓ |
| 4 | 1. lerakó a homlokfalnál, 3. az ajtónál | `LERAKO_SORREND`, 1 átrakás. Az optimalizált terv 0 átrakással érvényes. ✓ |
| 5 | Oldalsó lerakodás | Bal oldali kivétel szabad (nincs sértés) vagy elzárt (`LERAKO_SORREND`). Dobozos járműnél `AJTO_MERET`. ✓ |
| 6 | Részleges lerakodás | Jumbo motorkocsi, az 1. lerakó után a kormányzott tengely 14,5% < 20%: `KORMANYZOTT_TENGELY` „1. lerakó után”. Indulásnál rendben. ✓ |
| 7 | 40 cm-es hézag menetirányban | `HEZAG_MENETIRANY` légzsákos kitöltési javaslattal. ✓ |
| 8 | Rögzítési becslés | Előre, oldalra és hátra a pántszám megegyezik a kézi EN 12195-1 képlettel (μ = 0,45, STF 400 daN). Csúszásgátlóval (μ = 0,6) oldalra 0. ✓ |
| 9 | Magas, keskeny, önálló oszlop | `BORULAS`. Egy oldalon megtámasztva csak `BORULAS_ROGZITES` teendő. ✓ |
| 10 | Ismeretlen tömeg | „Nem igazolt”, állapot „Nem ellenőrzött”. Rá semmi nem kerül; az optimalizáló sem tesz rá. ✓ |
| 11 | V05/V06 tervlista a V07 használata után | Böngészőben: a V07-mentés után mindkét tárolt lista bájtra változatlan. ✓ |

További V07-tesztek:
- több egységen átívelő alátámasztás (90%, törékenynél 100%, túllógás, teher megoszlása);
- ajtóméret, tető alatti rés, „Ez a vége felfelé”;
- billenthető egység;
- villairány;
- topologikus lerakodási sorrend;
- terhelési diagram konzisztenciája;
- determinizmus;
- kimaradás okkal és javaslattal;
- V07 mentés és betöltés;
- integrációs export 1.1.0.

**P4 tulajdonságalapú teszt:** 1000 véletlen, megoldható eset (3–12 egység, vegyes méret, törékenység, halmozás, 1–3 lerakó). Minden esetben az A terv teljes és kemény hiba nélküli, és állapota megegyezik egy független újraellenőrzéssel.

A tesztek közben két hiba derült ki, mindkettő javítva:
1. A keresztirányú súlypont-kiegyenlítés elmozdíthatott egy magas oszlopot az oldaltámaszáról. Most a magas oszlopcsoport nem mozdul.
2. Az optimalizáló nem ellenőrizte építés közben a borulást. Most minden jelöltnél ellenőrzi, és a jobb fal melletti pozíciókat is megvizsgálja.

## 3. Böngészős ellenőrzés (`http://localhost:8137/v07/`)

| Ellenőrzés | Eredmény |
|---|---|
| Betöltés, konzolhiba | Minden modul és a `vendor/three/three.min.js` betölt; konzolhiba nincs. |
| Fotorealisztikus 3D | Vontató + pótkocsi tengelyekkel. EUR-raklap kartonozott árutömbbel és sztreccsfóliával, IBC, gitterbox, hordók, acéltekercs, big bag, címkék lerakószámmal. Árnyékok, metszet. Ajtóból és targoncás nézet animált kameraváltással. |
| Kijelölés és elhelyezés 3D-ben | Kattintásra kijelöl (sugárkövetés), „Miért itt?” indoklással. Új egység elhelyezésekor a zöld / piros szellemdoboz az okkal együtt jelenik meg. A blokkoló szabály üzenetet ad. |
| Optimalizálás (Worker) | 36 egység, 3 lerakó: 0 kemény hiba, 0 átrakás, 16% tartalék. 300 egység: minden elhelyezve, kb. 5,7 s (3 s keresés + döntő-ellenőrzés). |
| Biztonsági panel, tengelyek, diagram, rögzítés, idővonal, rakodási utasítás | Kitöltve. Az idővonal az „1. lerakó után” állapotban a maradék rakomány tengelyterhelését mutatja, a 3D-ben animálva veszi ki az egységeket. |
| Méretpontosság (P5) | 300 egységnél a kirajzolt egységdobozok és a tervadat között 0 cm az eltérés. A díszítőelemek (címke, szalag, fólia) legfeljebb 1,1 cm-rel nyúlnak túl. |
| Teljesítmény (P5) | 300 egység, 1206 × 712 px vászon, GPU-szinkronnal mérve: közepes 1,2–2,0 ms, magas 0,8–1,3 ms, alacsony 0,6–1,0 ms / képkocka. Ez jóval 30 FPS felett van; a mérőgép GPU-ja nincs dokumentálva. |
| PDF-ek | Teljes jelentés (V07 biztonsági, tengely-, rögzítési és lerakodási fejezetekkel), rakodási utasítás (sorrend + lépésenkénti felülnézetek), sofőrlap (lerakók, tengelyek, rögzítés, teendők, 3D kép, aláírás). A nyomtatási nézet felépül, a nyomtatás párbeszédablaka nem volt tesztelhető. |
| Egyszerű nézet | A kapcsoló elrejti a WebGL-vásznat, és a V06 vásznas nézete jelenik meg. Visszakapcsolható. |
| V05 / V06 | Mindkettő betölt, konzolhiba nélkül; a tárolt tervlistájuk változatlan. |

## 4. Nem ellenőrzött

- `file://` alatti futás: a klasszikus szkriptes three.js elvileg fájlból is betölt, de ezt valódi ablakban nem próbáltuk ki.
- HTML5 drag & drop a várakozóból: a kód a V06-tal azonos, a 3D-célpont sugárkövetéssel jön.
- Teljes képernyő.
- PNG-letöltés: a képkészítés függvényét a PDF-ek használják, és ott működött; magát a letöltést nem indítottuk el.

## 5. Szétosztás több járműre (0.7.1, 2026-11-27)

| Ellenőrzés | Eredmény |
|---|---|
| Node: 66 nem halmozható EUR-raklap | 2 félpótkocsi, ami az alsó korlát; minden egység pontosan egyszer, minden jármű szabályos |
| Node: 30 × 1000 kg | 2 jármű, egyik sem lépi túl a 24 t-t |
| Node: 3 lerakó × 20 raklap | „Előnyben” módban 2 jármű (egy lerakó megosztva, figyelmeztetéssel); „kötelező” módban minden lerakó egyetlen járművön |
| Node: kevés jármű / Jumbo / túlméretes egység | Kimaradás figyelmeztetéssel; Jumbo motorkocsi + pótkocsi az össztömeg kiszámításával; az önmagában sem férő egység kimarad, a többi elosztódik |
| Böngésző: 98 egység, 4 lerakó (Web Worker) | 2 jármű (alsó korlát: 2), 0,6 s, 0 kemény hiba. Kötelező módban 2 jármű, lerakómegosztás nélkül. Jumbo módban 3 raktér, az 1. szerelvény 38,4 t ≤ 40 t. Járművenkénti 3D-megnyitás és visszaállítás működik, konzolhiba nincs. |
