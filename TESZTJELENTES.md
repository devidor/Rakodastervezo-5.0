# Rakodástervező 3D 0.5 – fejlesztési és tesztjelentés

Készült: 2026-11-08. Alap: Rakodástervező 3D 0.4 (változatlanul megmaradt a `rakodastervezo_3d_v04` mappában).
FuvarDíj 4.0: `fuvar-kalkulator`, `feature/fuvardij-4` ág (`105cf84`). **Nem módosult.** A tesztek egy `git archive` útján kicsomagolt, csak olvasott példányt használnak.

## Elkészült lépések
| Lépés | Eredmény | Fájl |
|---|---|---|
| 1. LDM-modul | Önálló, függőség nélküli modul, egész cm-es belső adatokkal. Elméleti / fizikai / díjszámítási LDM, teljes geometriai és halmozási ellenőrzés (minden hibát összegyűjt), összehasonlítás, adatcsomag. | `ldm_modul.js` |
| 2. 3D ↔ LDM | Minden módosítás után újraszámol. LDM-kártyák, ellenőrzési lista, nem ellenőrzött feltételek, LDM-vonal a 3D-ben. Állítható pótkocsi, rakományazonosító, típus, szín, ismeretlen ráterhelés. | `index.html` |
| 3. Tervek összehasonlítása | Mentés, felülírás, megnyitás, törlés, export és import. A táblázat a kért oszlopokat és az állapotot mutatja. | `index.html` |
| 4. FuvarDíj 4.0 kapcsolat | JSON adatcsomag (díj nélkül) és Python-adapter, amely a FuvarDíj 4.0 eredeti `elszamolasi_ldm`, `elmeleti_ldm`, `szamol_dij` függvényét hívja. | `fuvardij_kapcsolat/fuvardij4_adapter.py` |

## Tesztek és eredmények (`tests/teszteredmenyek.txt`)
- **Node – 30/30 sikeres** (`node --test tests/ldm_modul.test.js`)
  - *Elméleti LDM:* képlet, forgatás-függetlenség, rétegszám-, belmagasság- és ráterhelés-korlát, nem halmozható és ismeretlen ráterhelés, terv szerinti halmozás, szűkített szélesség.
  - *Fizikai LDM:* egymás melletti dobozok (1,20, nem 3,60), forgatott raklapok (0,80), halmozott doboz (nem növeli a hosszt), homlokfal- és közbenső hézag, vegyes méretek.
  - *33 EUR raklap:* fizikai 13,20 ≠ elméleti 12,93 ≠ hosszösszeg 39,6.
  - *Ellenőrzés:* ütközés (érintkezés nem ütközés), határok mind a 3 tengelyen és forgatva, lebegő és részben alátámasztott doboz, nem halmozható alsó elem, rétegszám, ráterhelés, teherbírás, nem egész cm-es adat.
  - *Díjszámítás és csomag:* kerekítés, a három elszámolási szabály, tervösszehasonlítás, csomagtartalom, ajánlat-tiltás.
- **Python – 869/869 sikeres** (`py -m pytest tests`, `FUVARDIJ4_PATH` megadásával)
  - 600 véletlen és szélsőérték eset: a díjszámítási LDM **bitre azonos** a FuvarDíj 4.0 `elszamolasi_ldm` eredményével, minden szabály × kerekítés kombinációban.
  - 60 kerekítési eset (pl. 0,1 + 0,2; 2,0000000001; 1,005) és 200 elméleti LDM eset azonos a 4.0-val.
  - Adapter: a mintacsomagok egyeznek; a halmozott C tervnél díjszámítási 3,10 ≠ fizikai 2,40 (tömeg a meghatározó).
  - Elutasítás: hibás terv, manipulált LDM, előre kitöltött ár, nem egész cm, ismeretlen ráterhelésre halmozás, díjparaméter hiánya, LDM felülírási kísérlete.
  - Az ár azonos a közvetlen `szamol_dij` hívással.
- **Böngészős ellenőrzés** (helyi szerver, beépített böngésző)
  - Hiba nélkül betölt.
  - Valódi egérkattintásos elhelyezés, halmozás (60 cm magasra), forgatás (R): fizikai 10,10 LDM, homlokfal- és sávhézag-figyelmeztetés.
  - Elméleti 1,18 / 0,39 / 0,78 – kézzel ellenőrzött.
  - Mintatervek importja; az 5 soros táblázat helyes; a hibás D terv megnyitása indoklással elutasítva.
  - Pótkocsicsere: Mega, 1321 cm és 241 cm elfogadva; 200 cm és 239 cm elutasítva.
  - Nyílbillentyű a falon túlra vagy ütközésbe: elutasítva.
  - Ismeretlen ráterhelésnél „nem alkalmas árajánlatra”.
  - Mobilnézet (375 px): nincs vízszintes túlcsordulás.

## Mintatervek (`mintatervek/`) – ugyanaz a 12 EUR raklap (120×80×110 cm, 450 kg)
| Terv | Fizikai LDM | Díjszámítási LDM | Elméleti LDM | Alapterület | Szabad terület | Állapot |
|---|---:|---:|---:|---:|---:|---|
| A – hosszanti | 4,80 | 4,80 | 2,35 | 11,52 m² | 21,80 m² | Megfelel |
| B – keresztben forgatva | 4,80 | 4,80 | 2,35 | 11,52 m² | 21,80 m² | Megfelel |
| C – kétszintes halmozás | 2,40 | **3,10** | 2,35 | 5,76 m² | 27,56 m² | Megfelel |
| D – hibás | 4,20 | 4,20 | 0,78 | 2,40 m² | 30,92 m² | Nem felel meg |

A díjszámítási LDM-hez a FuvarDíj 4.0 alapbeállítását használtuk: maximum, 1750 kg/LDM, „Felfelé 0,1 LDM-re”. Ez **példabeállítás, nem fuvarozói tarifa**.

## Javított örökölt hiba
A 0.4 középre vonatkoztatott, méteres koordinátái páratlan cm-es belméretnél (245 cm → ±122,5 cm) félcentis pozíciókat adtak. A `snap()` ezeket a fal felé kerekítette, így egy fal melletti doboz nyílbillentyűvel vagy pótkocsicserénél 0,5 cm-rel „kilógott”. A 0.5-ben a vízszintes rács a homlokfalhoz és a bal falhoz igazodik (`snapX`, `snapY`).

## Nem ellenőrzött / korlátok
- Nem vizsgált: tengelyterhelés, súlypont, rögzítés, dinamikus terhelés, csomagolás valós teherbírása, részleges alátámasztás, rakodási sorrend. Ezeket a felület és a csomag is külön felsorolja.
- A díjszámítási szabályt a fuvarozó nem erősítette meg (`fuvarozo_megerositette: false`). Tarifát, súlyátváltási arányt és díjat a fejlesztés nem tartalmaz.
- A FuvarDíj 4.0 felületén még nincs csomagimport; az adapter a tervezett csatlakozási pont.
- A tervek helyi böngészőtárban vannak; tartós mentéshez az export szükséges.

## Futtatás
```
node --test tests/ldm_modul.test.js
node tests/generate_fixtures.js
set FUVARDIJ4_PATH=<FuvarDíj 4.0 forrásmappa>
py -m pytest tests
```
