# Külső összetevők és licencek

| Összetevő | Verzió | Forrás | Licenc | Fájl |
|---|---|---|---|---|
| three.js | 0.149.0 (r149) | npm-registry: `https://registry.npmjs.org/three/-/three-0.149.0.tgz` (a csomagból csak a `build/three.min.js` és a `LICENSE`) | MIT – lásd `three/LICENSE` | `three/three.min.js` |

A 0.149-es verzió azért került be, mert egyetlen UMD-fájlként (`window.THREE`) klasszikus `<script>`-tel is betölthető. Így a program `file://`-ról és GitHub Pages-ről is CDN nélkül fut.

## Textúrák és modellek

Minden textúra **procedurálisan, futásidőben** készül (`render3d.js`, canvas-rajzolás): fa, hullámkarton, kartonrács, padló, ponyva, aszfalt, szőtt zsák, rács és címkeatlasz. A modellek (raklap, karton, IBC, hordó, tekercs, gitterbox, láda, big bag, gép, jármű) a kódban, geometriai primitívekből épülnek. Külső kép- vagy modellfájl nincs, letöltés futásidőben nem történik.
