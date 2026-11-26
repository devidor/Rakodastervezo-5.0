# CHANGELOG – Rakománytervező 3D V05 → V06

## 0.6.0 – 2026-11-26 – Smart Load Optimizer

### Új
- **Geometriai motor** (`geometria.js`): egységes, egész cm-es koordinátarendszer (homlokfal × bal fal × padló), AABB-ütközés (az érintkezés nem ütközés), egyenletes rácsos térbeli index, valamint rácslépés (1 / 5 / 10 cm / szabad) és kapcsolható, állítható küszöbű mágneses illesztés.
- **Halmozási rendszer** (`ellenorzo.js`):
  - három mód: *nem halmozható*, *semmi a tetejére*, *szintkorlátos* (2 / 3 / 4 / egyedi);
  - az oszlop szintkorlátjánál a legszigorúbb tag dönt;
  - ismeretlen terhelhetőség esetén nincs automatikus halmozás;
  - új hibakódok: `FELSO_TILTOTT`, `OSZLOP_SZINT`, `FORGATAS_TILTOTT`, `LERAKO_SORREND`;
  - a terv állapota: *Érvényes / figyelmeztetésekkel / Nem ellenőrzött / Érvénytelen / Részleges*.
- **Automatikus optimalizáló** (`optimalizalo.js`):
  - Extreme Point-elhelyezés vetítéssel, Best Fit pontozás, FFD-sorrendek 6 kulccsal, seedelt (mulberry32) véletlen keresés;
  - három üzemmód idő- és iterációkorláttal;
  - Web Worker, `file://` alatt fő szálas tartalék;
  - megszakítható, megszakításkor az addigi legjobb eredmény megmarad;
  - becsült alsó korlát;
  - kimaradó egységek okkóddal: `NEM_FER_BE`, `HASZNOS_TEHER_TULLEPES`, `NINCS_SZABAD_HELY`;
  - a részleges eredmény „RÉSZLEGES” jelölést kap.
- **A / B / C tervek**:
  - A: minimális helyigény;
  - B: legnagyobb összefüggő szabad tér;
  - C: lerakodási sorrend, csak akkor készül, ha minden egységhez van lerakóhely;
  - összehasonlító táblázat, és bármelyik terv alkalmazható a munkaterületre.
- **Szabad helyek** (`szabad_ter.js`): maximális üres terek, átfedésmentes felbontás, pontos szabad térfogat. Kapcsolható 3D-megjelenítés, lista, részletek és javaslatok.
- **LDM-mutatók** (`mutatok.js`):
  - elméleti LDM konfigurálható referenciaszélességgel (alapérték 2,40 m);
  - halmozással korrigált LDM;
  - fizikai helyigény, elfoglalt és szabad padlóterület, padló- és térfogat-kihasználtság;
  - megtakarítás a halmozás és forgatás nélküli egyszerű sorrendhez képest.
- **Kezelőfelület**:
  - felső vezérlősáv (új terv, mentés, betöltés, visszavonás és újra (Ctrl+Z / Ctrl+Y, 100 lépés), optimalizálás, megszakítás, export menü, teljes képernyő);
  - tételbevitel a kötelező sorrendben, össztömeg-előnézettel;
  - jobb panelen a kijelölt egység szerkeszthető X/Y/Z koordinátáival, forgatásával és lerakóhelyével;
  - figyelmeztetések, szabad helyek;
  - kibővített alsó állapotsáv;
  - 2D felül-, oldal- és hátulnézet; 3D oldal- és hátulnézet;
  - kapcsolható méretvonalak és azonosítók.
- **Járművek**: Standard / Mega / Semi-mega félpótkocsi, Jumbo (két külön raktérsablon), dobozos teherautó, kisteherautó, egyedi. Tájékoztató értékek.
- **Export** (`terv_io.js`, `rajz2d.js`):
  - V06 JSON;
  - PNG (3D és 2D felülnézet);
  - PDF nyomtatási nézettel (rakománylista, jármű, mutatók, elhelyezés, 2D/3D kép, figyelmeztetések, dátum, verzió);
  - fuvardíjkalkulátor-adatcsomag `schemaVersion 1.0.0`, ár nélkül, visszaimportálható.
- **Tesztek**: 32 új Node-teszt (`tests/v06.test.js`), teljesítménymérés (`tests/teljesitmeny.js`), mintagenerátor és 17 új mintafájl.

### Módosult
- A tervfájl formátuma `version: 6`, a koordináták a homlokfaltól mért egész cm-ek (a V05-ben a pótkocsi közepéhez képest). A V03–V05 fájlok automatikusan átalakulnak.
- A V05 „nem halmozható” jelölőnégyzete (`stackable: false`) a V06-ban „semmi a tetejére” lett, mert a V05 is így kezelte: más egységen állhatott.
- Kézi elhelyezésnél a V06 egységes ellenőrzője dönt. A V05 szabályain túl tiltja, hogy nem halmozható egység más egységen álljon, valamint az oszlopszint és a forgatási tilalom megsértését.
- Az egységek száma legfeljebb 300 (a V05-ben 100), egy tételben legfeljebb 200.
- A súly egy tizedesjegyig adható meg.

### Javítva
- **V05-mentés páratlan belső szélességnél:** a V05 a középre vonatkoztatott koordinátát kerekítve mentette, ezért a jobb falhoz illesztett doboz visszatöltéskor 1 cm-rel kilóghatott. A V06 a V05-fájlokat pontos képlettel alakítja vissza, és szükség esetén ±1 cm-rel javít; a javítást jelzi.

### Változatlan
- `ldm_modul.js`, `fuvardij_kapcsolat/fuvardij4_adapter.py`, a FuvarDíj 4.0 adatcsomag formátuma és a 30 + 869 V05-teszt.
- A V05 a repó gyökerében, illetve a `Desktop/fuvar/Rakodástervező/rakodastervezo_3d_v05` mappában érintetlen.
