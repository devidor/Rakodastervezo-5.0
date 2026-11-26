# Fuvardíjkalkulátor-integráció – adatkapcsolati dokumentáció

**Célalkalmazás:** `fuvardijkalkulator-claude` (GitHub: `devidor/fuvardijkalkulator-claude`, helyben: `Desktop/Testing/fuvar-kalkulator`).
- `main` ág: 3.0, benne a Rakomány fül.
- `feature/fuvardij-4` ág: 4.0, a díjszámítási LDM forrása.

Ebben a fejlesztési szakaszban **a kalkulátor repója nem módosult**. Az adatcsomag ágfüggetlen, és **díjat nem tartalmaz**. Az árat kizárólag a kalkulátor számolhatja.

Két kimenet van:

| Kimenet | Formátum | Forrás | Mire való |
|---|---|---|---|
| FuvarDíj 4.0 adatcsomag (V05-ös, változatlan) | `fuvardij4-rakodasi-csomag`, `verzio: 1` | Elemzés → „Adatcsomag letöltése” | A `fuvardij_kapcsolat/fuvardij4_adapter.py` a 4.0 eredeti függvényeivel újraszámol (869 paritásteszt) |
| **V06 fuvardíjkalkulátor-export (új)** | `rakodastervezo-fuvardij-export`, `schemaVersion: 1.0.0` | Exportálás → „JSON – fuvardíjkalkulátor-adatcsomag” | Általános, ágfüggetlen átadás; visszaimportálható a tervezőbe |

## A V06 export szerkezete (`schemaVersion` 1.0.0)

Mértékegységek: hossz cm, tömeg kg, LDM m. Koordináták: a homlokfaltól (x), a bal faltól (y) és a padlótól (z), a bal-első-alsó sarok, egész cm.

| Mező | Típus | Tartalom |
|---|---|---|
| `format` | string | mindig `"rakodastervezo-fuvardij-export"` |
| `schemaVersion` | string (semver) | adatséma-verzió; nem kompatibilis változásnál a főverzió nő |
| `letrehozva` | ISO-8601 | létrehozás ideje |
| `forras` | object | `alkalmazas`, `verzio` (programverzió, pl. `0.6.0`) |
| `jarmu` | object | `tipus`, `belsoHosszCm`, `belsoSzelessegCm`, `belsoMagassagCm`, `hasznosTeherKg` (tájékoztató sablonérték vagy kézi adat) |
| `tetelek[]` | array | tételenként: `rakomanyAzonosito`, `megnevezes`, `darabszam`, `hosszCm`, `szelessegCm`, `magassagCm`, `egysegsulyKg`, `ossztomegKg`, `halmozhatosag` {`mod`: `nem`/`semmi`/`szint`, `leiras`, `maxSzint`, `maxFelsoTerhelesKg` (null = ismeretlen)}, `elforgathato`, `lerakohely`, `egysegek` (belső azonosítók) |
| `mutatok` | object | `referenciaSzelessegM`, `elmeletiLdm`, `elmeletiLdmHalmozassal`, `fizikaiHelyigenyM`, `dijszamitasiLdm` (FuvarDíj 4.0 szabály, JS-tükör), `padloKihasznaltsagPct`, `terfogatKihasznaltsagPct`, `ossztomegKg`, `elhelyezettTomegKg` |
| `elhelyezett` | object | `darab`, `egysegek[]` {`id`, `x`, `y`, `z`, `forgatva90`} |
| `elNemHelyezett` | object | `darab`, `egysegek[]` {`id`, `ok`: hibakód, pl. `NEM_FER_BE`, `HASZNOS_TEHER_TULLEPES`, `NINCS_SZABAD_HELY`, `NINCS_ELHELYEZVE`} |
| `optimalizalas` | object / null | `mod`, `terv` (A/B/C), `seed`, `iteracio`, `idoMs`, `megszakitva`, `heurisztikus: true`; null, ha a terv nem optimalizálásból származik |
| `ervenyesseg` | object | `allapot` (Érvényes / Érvényes figyelmeztetésekkel / Nem ellenőrzött / Érvénytelen / Részleges), `ervenyes` (bool: hibátlan **és** teljes), `hibak[]`, `figyelmeztetesek[]` {`kod`, `szoveg`} |
| `arazas` | null | mindig null – a csomag nem tartalmaz díjat |
| `rakomanyterv` | object | a teljes, szerkeszthető V06 terv (`format: rakodastervezo-3d`, `version: 6`) |

Minta: [`mintatervek/v06_fuvardij_export_minta.json`](mintatervek/v06_fuvardij_export_minta.json) (2. teszt, optimalizált A terv).

## Javasolt fogadási szabályok a kalkulátor oldalán (későbbi fejlesztés)
1. Ellenőrizd a `format` és a `schemaVersion` főverzióját. Szerkezeti ellenőrzés: a `terv_io.js` `integracioEllenoriz()` függvénye, ezt használja a teszt is.
2. Árajánlatot csak akkor készíts, ha `ervenyesseg.ervenyes === true`. Részleges vagy érvénytelen tervből nem szabad ajánlatot adni.
3. A `fizikaiHelyigenyM` és az `elmeletiLdm` nem azonos díjszámítási alap. A díjszámítási LDM-et a 4.0 ágon a kalkulátor saját `elszamolasi_ldm` függvénye számolja újra (mint a V05 adapterben).
4. A `tetelek[]` közvetlenül megfeleltethető a `main` ág Rakomány fülének tételsoraival: darabszám, méretek, egységsúly, halmozhatóság.

## Import
A tervező a saját exportját visszatölti (Betöltés → a `rakomanyterv` mezőből). Ellenőrzi az egységazonosítók egyediségét, a méretek, súlyok és koordináták tartományát, és hibás fájlt nem tölt be.
