# Fejlesztési állapot – Rakománytervező 3D V06

Utolsó frissítés: 2026-11-26. Ág: `feature/v06` (repó: `devidor/Rakodastervezo-5.0`, helyben: `Desktop/Testing/Rakodastervezo-5.0`).

| Fázis | Állapot | Ellenőrzés |
|---|---|---|
| P0 – V06 mappa, V05-leltár, V05-tesztek | kész | 30/30 Node, 869/869 pytest a kiinduló példányon |
| P1 – geometria, illesztés, ütközés | kész, tesztelt | Node-tesztek + 8. teszt böngészőben |
| P2 – halmozás, egységes ellenőrző | kész, tesztelt | Node-tesztek + 5. teszt |
| P3 – optimalizáló + Web Worker | kész, tesztelt | 1–4., 6., 7. teszt, reprodukálhatóság, megszakítás, Worker és tartalék böngészőben |
| P4 – LDM-mutatók, szabad helyek | kész, tesztelt | 2. teszt LDM, szabadtér-tesztek, böngésző |
| P5 – A/B/C tervek | kész, tesztelt | C-terv teszt, böngésző |
| P6 – kezelőfelület | kész | böngészőben ellenőrizve (lásd TESZTJELENTES.md 3. pont) |
| P7 – mentés, export, integráció | kész, tesztelt | 9. teszt (Node + böngésző), séma-teszt, PNG/PDF/JSON böngészőben |
| P8 – teljes tesztkör, teljesítmény | kész | 62/62 Node, 869/869 pytest, `tests/teljesitmeny_eredmeny.txt` |
| P9 – dokumentáció | kész | – |

## Hátralévő / javasolt következő lépések
1. **Jumbo közös optimalizálása:** a két raktérre osztás egy futásban. Jelenleg két külön sablon van.
2. **„Minden irányban forgatható” opció** (6 orientáció), billenthető rakományhoz.
3. **Több egységen átívelő alátámasztás** konfigurálható minimum alátámasztási aránnyal. Jelenleg 100%, egyetlen alsó egységen.
4. **Jobb B terv:** célzott keresés a nagy összefüggő szabad térre. Jelenleg a közel legrövidebb tervek közül választ.
5. **Kalkulátoroldali import** a `fuvardijkalkulator-claude` repóban, külön feladatként (lásd INTEGRACIO.md).
6. **Kézi ellenőrzések:** teljes képernyő és várakozóból húzás (HTML5 drag & drop) valódi böngészőablakban. A beépített böngészőben ezek nem voltak ellenőrizhetők.
