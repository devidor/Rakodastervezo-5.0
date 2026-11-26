# V05 funkcióleltár és regressziós állapot (V06)

Forrás: a V05 (`v05/index.html`, `v05/ldm_modul.js`; korábban a repó gyökerében), amely bájtra azonos (a sorvégeket nem számítva) a `Desktop/fuvar/Rakodástervező/rakodastervezo_3d_v05` mappával.
Ellenőrzés módja: **B** = böngészőben, a V06 felületén (helyi szerver, beépített böngésző); **N** = automatizált Node-teszt; **P** = Python-teszt.

| # | V05-funkció | Vezérlés a V05-ben | V06 állapot | Ellenőrzés |
|---|---|---|---|---|
| 1 | Interaktív 3D nézet (saját Canvas 2D vetítés) | – | megmaradt | B |
| 2 | Kamera forgatása | jobb gombos húzás / Shift + bal húzás | változatlan | B |
| 3 | Nagyítás | Shift + görgő; görgő, ha nincs kijelölés | változatlan | B |
| 4 | Alapnézet, felülnézet (3D kamera) | „⌂ Alapnézet”, „▤ Felülnézet” | változatlan; új: oldal- és hátulnézet | B |
| 5 | Teljes képernyő | „⛶ Teljes képernyő” (a gomb a felső sávba került) | a kód változatlan | **nem ellenőrizhető**: a beépített böngésző a V05-ben és a V06-ban sem kapcsolt teljes képernyőre |
| 6 | Dobozok létrehozása darabszámmal | darabszám + „Dobozok a várakozóba” | bővítve: tételbevitel a kötelező sorrendben | B |
| 7 | Kézi elhelyezés kattintással (padlóra / egységre) | bal kattintás | változatlan | B |
| 8 | Behúzás a várakozóból (HTML5 drag & drop) | húzás a jobb oldali listából | a kód változatlan, a lista a jobb panelre került | kód szinten; valódi húzással nem teszteltük |
| 9 | Áthelyezés húzással, zöld/piros előnézet | bal húzás | változatlan; az ellenőrzés a V06 egységes ellenőrzője | B (8. teszt) |
| 10 | Forgatás 90°-kal | R vagy görgő | változatlan + a forgathatóság figyelembevétele | B |
| 11 | 1 / 10 cm-es léptetés | nyilak / Shift + nyilak | változatlan | B |
| 12 | Mágneses illesztés (10 cm) | automatikus | megmaradt, alapérték 10 cm; új: rácslépés és kapcsoló | N, B |
| 13 | Méretek módosítása | csúszkák + számmezők | változatlan (jobb panelre került) | B |
| 14 | Szín, azonosító, típus | mezők | változatlan; új: megnevezés | B |
| 15 | Halmozhatóság, rétegszám, ráterhelés | jelölőnégyzet + mezők | a „Másik doboz ráhelyezhető” jelölőnégyzet helyett 3 módú halmozhatóság (a V05-adatok automatikusan átalakulnak) | N, B |
| 16 | Kijelölt törlése, összes törlése, visszavitel a várakozóba | gombok | változatlan; új: „Mind vissza” | B |
| 17 | Pótkocsitípus (Normál / Semi-mega / Mega / Egyedi), méret, teherbírás | lista + mezők | megmaradt, új nevekkel: Standard / Semi-mega / Mega félpótkocsi; új járművek | B |
| 18 | Terv mentése / betöltése (JSON, V03–V05) | „Terv mentése”, „Betöltés” | V06 formátum; a V03–V05 fájlok betölthetők | N, B |
| 19 | LDM-kártyák (elméleti, fizikai, díjszámítási) | elemző szekció | megmaradt; az elméleti LDM alapértelmezett referenciája 2,40 m, a V05 (FuvarDíj 4.0) értéke alsorban látszik | N, B |
| 20 | Díjszámítási beállítás (kg/LDM, szabály, kerekítés) | mezők | változatlan | P (869 teszt) |
| 21 | Ellenőrzési lista, eltérések, nem ellenőrzött feltételek | elemző szekció | a lista a V06 ellenőrzőjét mutatja (V06-szabályokkal együtt) | B |
| 22 | Tervek összehasonlítása (mentés, felülírás, megnyitás, törlés, export, import) | táblázat | változatlan; az export V06-gyűjtemény, az import V05 és V06 | B |
| 23 | FuvarDíj 4.0 adatcsomag letöltése és előnézete | „Adatcsomag letöltése” | változatlan (a formátum és az `ldm_modul.js` sem változott) | B, P |
| 24 | Egérvezérlés súgó | „ⓘ Egérvezérlés” | változatlan | B |
| 25 | Automatikus elhelyezés | – | **a V05-ben nem volt**; a V06-ban új funkció | – |
