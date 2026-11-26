# Rakománytervező 3D V07 – Professional

Böngészős rakománytervező és -optimalizáló. Statikus webalkalmazás, build nélkül; az egyetlen külső könyvtár (three.js r149, MIT) **helyben** van a `vendor/three/` mappában, CDN nincs.

A V07 a V06 (Smart Load Optimizer) továbbfejlesztése három fő céllal, ebben a sorrendben:

1. **Sérülésmentes rakodás.** Szabályok a törékenységre, a nehéz-a-könnyűn helyzetre, a felületi nyomásra, a több egységen átívelő alátámasztásra, a borulásra, a súlypontra, a tengelyterhelésre, a hézagokra, az ajtóméretre és a tető alatti résre. Mellé rögzítési becslés az EN 12195-1 elvei szerint.
2. **Gyors, átrakás nélküli lerakodás.** A program ellenőrzi, hogy lerakóhelyenként hátulról, oldalról vagy felülről minden kivehető-e, figyeli a villairányt, becsüli a lerakodási időt, és ellenőrzi a tengelyterhelést minden lerakó után. Ebből készül a rakodási utasítás és a sofőrlap.
3. **Fotorealisztikus 3D.** PBR-anyagok, valós méretű raklap-, karton-, IBC-, hordó-, tekercs-, gitterbox-, láda-, big bag- és gépmodellek, jármű tengelyekkel. Lágy árnyékok, környezeti tükröződés, metszet, ajtó- és targoncás nézet, lerakodási animáció.

A V05 (`../v05/`) és a V06 (`../v06/`) változatlan. A V07 saját böngészőtárhely-kulcsot használ (`rakodastervezo3d.v07.tervek`), a V06 és a V05 tervlistáját egyszer, csak olvasva veszi át.

## Indítás

```powershell
py -m http.server 8137
```

A repó gyökeréből indítva: <http://localhost:8137/v07/> (a verzióválasztó: <http://localhost:8137/>).

- **GitHub Pages:** https://devidor.github.io/Rakodastervezo-5.0/v07/ (merge után).
- **Fájlból (`file://`):** a three.js egyetlen klasszikus szkriptfájl (`vendor/three/three.min.js`), így a 3D nézet fájlból is betölt, a Web Worker helyett pedig a fő szálas optimalizálás fut. Ha a böngésző a WebGL-t nem engedi, a program automatikusan a V06 vásznas nézetére vált („Egyszerű nézet”), és ez kézzel is választható.

## Tesztek

```powershell
node --test tests/
```

FuvarDíj 4.0-paritás (az `ldm_modul.js` változatlan):

```powershell
$env:FUVARDIJ4_PATH = "<FuvarDíj 4.0 kicsomagolt mappa>"; py -m pytest tests
```

## Fájlok (V07 új / módosított)

| Fájl | Szerep |
|---|---|
| `jarmu.js` | Járműprofilok (nyerges / szóló), tengelyterhelés emelőszabállyal, terhelési diagram, megengedett súlypont-tartomány |
| `biztonsag.js` | Sérülésmentességi szabályok, súlypont, tengely, hézag, rögzítési becslés, biztonsági tartalék, lexikografikus kulcs |
| `lerakodas.js` | Kivételi folyosók (hátsó / bal / jobb / felső), átrakásszám, villairány, csoportosítás, időmodell, lerakodási és rakodási sorrend |
| `optimalizalo_profi.js` | Profi optimalizáló: lerakó-tudatos konstrukció, kemény szabályok jelöltenként, borulásvédelem, keresztirányú kiegyenlítés, tengelyhez igazítás, A/B/C döntés lexikografikus kulccsal |
| `render3d.js` | Fotorealisztikus WebGL-megjelenítő (three.js), procedurális textúrák, összevont geometria, kijelölés sugárkövetéssel |
| `vendor/three/` | three.js r149 (`three.min.js`, MIT `LICENSE`) – lásd `vendor/LICENCEK.md` |
| `ellenorzo.js` | V06 + opcionális több egységen átívelő alátámasztás (`tobbTamasz`); nélküle a V06-szabály változatlan |
| `terv_io.js` | V07-mentés (version 7), járműprofil és V07-mezők, V03–V06 betöltés, integrációs export 1.1.0 |
| `index.html` | Felület: 3D, biztonsági panel, tengelyterhelés és diagram, rögzítés, lerakodási idővonal, rakodási utasítás, új PDF-ek |
| `ldm_modul.js`, `geometria.js`, `szabad_ter.js`, `mutatok.js`, `optimalizalo.js`, `rajz2d.js` | A V06-tal azonos (a V06-os optimalizáló a régi teszteknek és a V06-módnak megmaradt) |

Dokumentáció: [HASZNALATI_UTMUTATO.md](HASZNALATI_UTMUTATO.md) · [CHANGELOG.md](CHANGELOG.md) · [TESZTJELENTES.md](TESZTJELENTES.md) · [INTEGRACIO.md](INTEGRACIO.md) · [FEJLESZTESI_ALLAPOT.md](FEJLESZTESI_ALLAPOT.md) · [V06_FUNKCIOLELTAR.md](V06_FUNKCIOLELTAR.md) · korábbi: [TESZTJELENTES_V06.md](TESZTJELENTES_V06.md), [FEJLESZTESI_ALLAPOT_V06.md](FEJLESZTESI_ALLAPOT_V06.md), [V05_FUNKCIOLELTAR.md](V05_FUNKCIOLELTAR.md)

> **Fontos.** A terv a megadott adatok alapján a modellezett szabályoknak felel meg. A tényleges rögzítés és a rakomány állapota a rakodást végző felelőssége. A program nem ad hatósági vagy EN 12195-1 szerinti minősítést. A járművek tengely- és felépítményadatai sablonértékek, a tényleges jármű adataival ellenőrizendők és módosíthatók.
