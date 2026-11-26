# Rakománytervező 3D V06 – Smart Load Optimizer

Böngészős rakománytervező és -optimalizáló. Statikus webalkalmazás: build, telepítés és külső (CDN-/npm-) függőség nélkül fut.
A V05 a repó gyökerében változatlanul megmaradt; a V06 ebben a mappában (`rakodastervezo_3d_v06/`) önállóan futtatható.

## Indítás

**Ajánlott: helyi HTTP-szerver.** Így az optimalizáló Web Workerben, háttérszálon fut:

```powershell
py -m http.server 8136 --directory rakodastervezo_3d_v06
```

Ezután nyisd meg böngészőben: <http://localhost:8136/>

- **GitHub Pages:** ha a repó gyökeréből (`main` / root) van közzétéve, a V06 a `…/rakodastervezo_3d_v06/` címen érhető el. A V05 továbbra is a gyökér `index.html`.
- **Fájlból (`index.html` dupla kattintással):** működik, de a böngészők `file://` alatt nem indítanak Web Workert. Ilyenkor az optimalizálás a fő szálon, kis szeletekben fut, így a felület nem fagy le, és a megszakítás is működik. Ez a módszer a beépített böngészőben nem volt tesztelhető; a Worker letiltásával szimulálva ellenőriztük (lásd: TESZTJELENTES.md).
- **Claude Code előnézet:** a `Testing/.claude/launch.json` fájlban a `rakodastervezo-3d-v06` konfiguráció (8136-os port).

## Tesztek

```powershell
node --test tests/ldm_modul.test.js tests/v06.test.js
```

FuvarDíj 4.0-paritás (Python). Ehhez szükséges a FuvarDíj 4.0 csak olvasható, kicsomagolt példánya, például `git archive origin/feature/fuvardij-4` paranccsal:

```powershell
$env:FUVARDIJ4_PATH = "<FuvarDíj 4.0 kicsomagolt mappa>"; py -m pytest tests
```

Teljesítménymérés (kb. 3 perc), az eredmény a `tests/teljesitmeny_eredmeny.txt` fájlba kerül:

```powershell
node tests/teljesitmeny.js
```

A mintatervek újragenerálása (`mintatervek/v06_*.json`):

```powershell
node tests/mintak_generalasa.js
```

## Fájlok

| Fájl | Szerep |
|---|---|
| `index.html` | Felület: 3D-nézet (saját Canvas 2D vetítés), panelek, vezérlés |
| `ldm_modul.js` | V05 LDM-modul, **változatlan** (FuvarDíj 4.0-paritás) |
| `geometria.js` | Egységes koordinátarendszer, AABB, térbeli index, rács- és mágneses illesztés |
| `ellenorzo.js` | Halmozási módok és egységes érvényesség-ellenőrzés (hibakódok, állapot) |
| `szabad_ter.js` | Maximális üres terek, átfedésmentes felbontás, javaslatok |
| `mutatok.js` | Elméleti / korrigált / fizikai / díjszámítási LDM, kihasználtság |
| `optimalizalo.js` | 3D bin packing heurisztika (Extreme Point + Best Fit + FFD + seedelt véletlen keresés) |
| `optimalizalo_worker.js` | Web Worker burkoló |
| `terv_io.js` | V06-mentés, V03–V05 betöltése, fuvardíjkalkulátor-export |
| `rajz2d.js` | 2D felül-, oldal- és hátulnézet méretvonalakkal |
| `fuvardij_kapcsolat/` | V05 FuvarDíj 4.0 adapter (változatlan) |
| `tests/` | Node- és Python-tesztek, teljesítménymérés, mintagenerátor |
| `mintatervek/` | V05-minták és a V06 tesztesetek tervei |

Dokumentáció: [HASZNALATI_UTMUTATO.md](HASZNALATI_UTMUTATO.md) · [CHANGELOG.md](CHANGELOG.md) · [TESZTJELENTES.md](TESZTJELENTES.md) · [INTEGRACIO.md](INTEGRACIO.md) · [FEJLESZTESI_ALLAPOT.md](FEJLESZTESI_ALLAPOT.md) · [V05_FUNKCIOLELTAR.md](V05_FUNKCIOLELTAR.md)

> A program rakodástervezést és díjkalkuláció-előkészítést támogat. A geometriai és halmozási ellenőrzés nem igazolt rakományrögzítési vagy közlekedésbiztonsági minősítés. A járműsablonok tájékoztató jellegűek.
