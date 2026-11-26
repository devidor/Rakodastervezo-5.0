# V06 funkcióleltár és regressziós állapot (V07)

Ellenőrzés: **B** = böngészőben (`http://localhost:8137/v07/`), **N** = Node-teszt, **P** = Python-teszt. A V06 62 Node-tesztje a `v07/` alatt változatlanul fut (N).

| # | V06-funkció | V07 állapot | Ellenőrzés |
|---|---|---|---|
| 1 | 3D nézet (Canvas 2D vetítés) | Fotorealisztikus WebGL-nézet. A régi nézet „Egyszerű nézet” néven elérhető, és WebGL hiányában automatikus tartalék. | B |
| 2 | Kamera: jobb húzás / Shift + görgő | Változatlan vezérlés, a 3D kamerán. | B |
| 3 | Nézetgombok (alap, felül, oldal, hátul) | Megmaradtak animált váltással, új: ajtóból, targoncás. | B |
| 4 | Teljes képernyő | Kód változatlan. | nem ellenőrizhető a beépített böngészőben |
| 5 | Tétel létrehozása (darabszám, méret, súly, halmozás, terhelhetőség) | Változatlan, bővítve a V07-mezőkkel és tömeges bevitellel. | B |
| 6 | Kézi elhelyezés kattintással, kijelölés | 3D-ben sugárkövetéssel, zöld / piros szellemdobozzal. | B |
| 7 | Várakozóból húzás (HTML5 drag & drop) | Kód változatlan, a célpont 3D-ben sugárkövetéssel jön. | nem ellenőrizhető a beépített böngészőben |
| 8 | Bal húzás áthelyezés, nyilak, R-forgatás, X / Y / Z mezők | Változatlan; blokkolnak a helyi V07-szabályok is. | B (kijelölés, elhelyezés) |
| 9 | Rács- és mágneses illesztés | Változatlan (`geometria.js`). | N |
| 10 | Halmozási módok, szintkorlát, ismeretlen terhelhetőség | Változatlan, és több egységen átívelő alátámasztással bővítve. | N |
| 11 | Optimalizáló (gyors / intelligens / maximális, Worker, megszakítás, seed) | Profi optimalizáló ugyanezekkel; a V06-os modul megmaradt. | N, B |
| 12 | A / B / C terv, alkalmazás gombbal | Új tartalommal (ajánlott / helyigény / tartalék) és bővített táblázattal. | B |
| 13 | LDM-mutatók (elméleti, korrigált, fizikai, díjszámítási) | Változatlan. | N, P |
| 14 | Szabad helyek (lista + kiemelés) | Változatlan, 3D-ben áttetsző térrészként. | N |
| 15 | 2D felül-, oldal- és hátulnézet | Változatlan. | B |
| 16 | Visszavonás / újra | Változatlan, a V07-mezők és a járműprofil is visszaáll. | B |
| 17 | Mentés / betöltés, V03–V06 | Version 7 mentés, V03–V06 betöltése. | N |
| 18 | Tervek összehasonlítása, tervgyűjtemény | Változatlan, V07 tárkulccsal. | B |
| 19 | FuvarDíj 4.0 adatcsomag | Változatlan. | P |
| 20 | Export: JSON, PNG, PDF, integrációs export | Bővítve: PNG 2× / 4× / átlátszó, három PDF, integrációs export 1.1.0. | B, N |
