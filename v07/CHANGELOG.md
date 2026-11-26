# CHANGELOG – Rakománytervező 3D V05 → V06 → V07

## 0.7.0 – 2026-11-26 – Professional

### Új
- **Sérülésmentességi szabályok** (`biztonsag.js`), mindegyik hibakóddal, magyar üzenettel, az érintett egységekkel és 3D-kiemeléssel:
  - kemény szabályok: `TOREKENY_HALMOZAS`, `NEHEZ_KONNYUN`, `FELULETI_NYOMAS`, `BORULAS`, `SULYPONT_HOSSZ`, `SULYPONT_KERESZT`, `TENGELYTERHELES`, `KORMANYZOTT_TENGELY`, `AJTO_MERET`, `TETO_RES`, `ALLO_FORDITVA`;
  - teendők / figyelmeztetések: `HEZAG_MENETIRANY`, `HEZAG_OLDAL`, `ROGZITES_ELEGTELEN`, `BORULAS_ROGZITES`, `SULYPONT_MAGAS`, `ADR_ELKULONITES`, `NEM_IGAZOLT_TOMEG`.
- **Több egységen átívelő alátámasztás** (`ellenorzo.js`, opcionális `tobbTamasz`):
  - legalább 90%-os érintkezés kell, törékeny egységnél 100%, túllógás nélkül;
  - a ráterhelés az érintkezési területek arányában oszlik meg.
- **Járműprofilok és tengelyterhelés** (`jarmu.js`):
  - nyerges (királycsap, vontató első és hajtott tengely, pótkocsi-tengelycsoport) és szóló jármű;
  - terhelési diagram, megengedett súlypont-tartomány, a kormányzott tengely minimuma;
  - sablonértékek, a felületen szerkeszthetők.
- **Lerakodás** (`lerakodas.js`):
  - kivételi folyosók (hátsó, bal, jobb, felső) emelési ráhagyással;
  - átrakásszám, villairány, egy lerakó szétszórt egységeinek jelzése;
  - időmodell; topologikus lerakodási sorrend, és ennek fordítottjaként a rakodási sorrend;
  - tengelyterhelés minden lerakó után.
- **Rögzítési becslés** (EN 12195-1 elvei): irányonként a blokkolt és a szabad tömeg, a fal kapacitása (L / XL, függöny) és a szükséges pántszám. Mellé élvédő-, légzsák- és csúszásgátló-javaslat.
- **Profi optimalizáló** (`optimalizalo_profi.js`):
  - lexikografikus cél: kimaradt → kemény hiba → átrakás → tartalék → idő → hossz;
  - lerakó-tudatos sorrendek, halmozás nélküli változatok, borulásvédelem építés közben;
  - keresztirányú kiegyenlítés, és szükség esetén a rakomány hátrébb tolása a tengelyterhelés miatt;
  - új A / B / C terv: ajánlott / legkisebb helyigény / legnagyobb tartalék;
  - kimaradásnál okkal és javaslatokkal.
- **Fotorealisztikus 3D** (`render3d.js`, three.js r149 helyben):
  - PBR-anyagok, procedurális textúrák, valós méretű egység- és járműmodellek;
  - lágy árnyék, környezeti tükröződés, ACES tónusleképezés;
  - metszet, ajtóból és targoncás nézet, lerakodási animáció;
  - pántok, élvédők és légzsákok megjelenítése;
  - minőségi szintek automatikus visszaváltással; egyszerű (V06) nézet tartalékként.
- **Felület:**
  - biztonsági panel közlekedési lámpával;
  - tengelyterhelés-oszlopok és terhelési diagram, rögzítési táblázat, lerakodási idővonal, rakodási utasítás;
  - „Miért itt?” indoklás a kijelölt egységnél;
  - új tételmezők: törékenység, kezelés, villairány, lerakodási oldal, állás / billentés, címzett, rendelésszám, ADR, felületi nyomás, nem igazolt tömeg;
  - tömeges bevitel CSV-ből vagy Excel-vágólapról;
  - szabálybeállítások panel.
- **Export:**
  - PNG 2× és 4× felbontásban, átlátszó háttérrel is;
  - PDF: teljes jelentés, rakodási utasítás (lépésenkénti ábrákkal), sofőrlap;
  - integrációs export 1.1.0 (`biztonsag` blokk, `arazas: null`).
- **Mentés:** version 7, járműprofillal és V07-mezőkkel. Saját tárkulcs (`rakodastervezo3d.v07.tervek`); a V06- és V05-lista csak olvasva kerül át.

### Változatlan
- `ldm_modul.js` (FuvarDíj 4.0-paritás 869/869), `geometria.js`, `szabad_ter.js`, `mutatok.js`, `rajz2d.js`. A V06-os `optimalizalo.js` és a V06-tesztek is megmaradtak.


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
- A V05 a `v05/` mappában (korábban a repó gyökerében), illetve a `Desktop/fuvar/Rakodástervező/rakodastervezo_3d_v05` mappában érintetlen.

## 0.6.0-1 – 2026-11-26 – verziók szétválasztása
- A repó szerkezete: `v05/` (változatlan V05), `v06/` (ez a verzió), a gyökérben verzióválasztó oldal.
- A V06 saját böngészőtárhely-kulcsot használ (`rakodastervezo3d.v06.tervek`), így a GitHub Pages közös originjén sem írja felül a V05 mentett tervlistáját; a V05 listáját első indításkor egyszer, csak olvasva veszi át.
