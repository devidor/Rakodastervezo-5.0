# Fejlesztési állapot – Rakománytervező 3D V07 Professional

Utolsó frissítés: 2026-11-26. Ág: `feature/v07` (a `feature/verziovalaszto` ágra épül). Repó: `devidor/Rakodastervezo-5.0`.

## Fázisok

| Fázis | Tartalom | Állapot | Ellenőrzés |
|---|---|---|---|
| P0 | Mentés, `v07/` másolat, verzióválasztó 3. gomb, saját tárkulcs | kész | `backup/verziovalaszto-2026-11-26` ág + helyi bundle; V05/V06 fájljai nem változtak; tárkulcsok böngészőben ellenőrizve |
| P1 | Adatmodell, járműprofil, V03–V06 betöltés | kész | Node: I/O-tesztek (version 7, profil, V07-mezők, V03 → nem igazolt tömeg) |
| P2 | Sérülésmentességi szabályok | kész | Node: 1–3., 7–10. kötelező eset + alátámasztás, ajtó, tető, billentés |
| P3 | Lerakodás, időmodell, tengely lerakónként | kész | Node: 4–6. eset, villairány, topologikus sorrend; böngésző: idővonal |
| P4 | Profi optimalizáló | kész | Node: 1000 véletlen eset 0 hibával, determinizmus, kimaradás javaslatokkal |
| P5 | Fotorealisztikus 3D | kész | Böngésző: méretpontosság (0 cm eltérés), 300 egységnél 0,6–2,0 ms / képkocka, egyszerű nézet tartalék |
| P6 | Felület, export, PDF-ek | kész | Böngésző: teljes jelentés, rakodási utasítás, sofőrlap; 1.1.0 export Node-teszttel |
| P7 | Tesztkör, dokumentáció | kész | 85/85 Node, 869/869 pytest |

## Nyitott kérdések (az alapértékekkel készült el)

1. **Valós tengely- és diagramadatok.** A sablonok tipikus értékek; a jármű adatainál kézzel felülírhatók (forrás: „kézi”).
2. **Lerakodási alapidők.** 90 / 120 / 20 / 180 s – a „Sérülésmentességi szabályok” panelen állíthatók.
3. **Hézag és tűrések.** A hézag 5 cm, a nehéz a könnyűn tűrés 0%, a keresztirányú tűrés ±5% a teljes jármű súlypontjára. Rakományra is átállítható: `keresztAlap: 'rakomany'`.
4. **Oldalsó és felső lerakodás.** Mindkettő benne van (függönyös járműnél; dobozos járműnél az oldal tiltott).
5. **Külön V07 verzió.** Igen, `v07/` mappa.

## Ismert korlátok / javasolt következő lépések

- **Több jármű (0.7.1).** A szétosztás kész, Jumbo szerelvénnyel is: a két raktér két terv, közös össztömeg-ellenőrzéssel. A két raktér közötti súlypont- és tengelyterhelés-kölcsönhatás (vonórúd) nincs modellezve. A járműszám heurisztikus, az alsó korlátot a program kiírja.
- **Rögzítés.** Becslés leszorító lekötésre, egyenletes eloszlással. A közvetlen (diagonális) lekötés és a dőlés elleni számítás egyszerűsített: oszlopszintű borulásvédelemmel.
- **Környezeti takarás.** Csúcsszínekkel sötétített alsó élek (érintkezési árnyék) és lágy árnyéktérkép van, képtérbeli SSAO-utófeldolgozás nincs. A three.js r149 core ezt nem tartalmazza, és az addon-fájlok helyben tárolása külön döntés lenne.
- **Kézi ellenőrzés valódi böngészőablakban.** A teljes képernyő, a HTML5 drag & drop a várakozóból, valamint a `file://` alatti 3D és Worker-tartalék. A beépített böngészőben ezek nem ellenőrizhetők.
- **Optimalizálás vége.** A döntőbe jutott tervek teljes V07-ellenőrzése nagy tervnél (300 egység) kb. 1–2 s-mal hosszabbítja a futást. Gyorsítótár csökkenti az ismétléseket.
