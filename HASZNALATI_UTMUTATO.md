# Rakodástervező 3D 0.5 – rövid használati útmutató

## Indítás
Nyissa meg az `index.html` fájlt Chrome-ban, Edge-ben vagy Firefoxban. Az `ldm_modul.js` fájlnak ugyanabban a mappában kell lennie. Telepítés és internet nem kell.

## 1. Pótkocsi és rakomány megadása
1. **⓪ Pótkocsi belső méretei:** Normál / Semi-mega / Mega (a FuvarDíj 4.0 méretei), vagy egyedi hossz, szélesség, magasság (egész cm) és teherbírás. Ha a ténylegesen szabad tér kisebb (kerékdob, rögzítősín), adja meg egyedi méretként. A már elhelyezett dobozok a homlokfaltól mért helyükön maradnak. Ha az új méretbe nem férnének be, a program elutasítja a módosítást.
2. **① Rakománytételek:** adja meg a darabszámot, majd kattintson a „Dobozok a várakozóba” gombra. Ha előtte kijelöl egy dobozt, az új dobozok annak méreteit, típusát és színét öröklik.
3. **② Méretek:** hosszúság, szélesség, magasság (cm), **rakományazonosító**, **típus** és **szín**.
4. **③ Halmozás:** tömeg (kg), „másik doboz ráhelyezhető”, maximális rétegszám és maximális ráterhelés. Üres ráterhelés = *ismeretlen*. Ilyenkor a halmozás megengedett, de „nem igazolt” lesz, és az ilyen tervből **nem készíthető árajánlat**.

## 2. Rakodás a 3D-nézetben (a 0.4-hez képest változatlan)
Húzza a dobozt a várakozólistából a padlóra vagy egy másik doboz tetejére. Forgatás: **R** vagy egérgörgő. Finom mozgatás: nyílbillentyűk (1 cm, Shifttel 10 cm). A kamerát jobb egérgombbal lehet forgatni. A sárga szaggatott vonal a **fizikai LDM** határát jelöli, az „ELEJE” felirat pedig a homlokfalat.

## 3. A három LDM-mutató (az oldal alján)
| Mutató | Jelentés |
|---|---|
| **A · Elméleti** | Alapterület ÷ (pótkocsi-szélesség × 100). Három változat: halmozás nélkül; az adatokból megengedett halmozással (rétegszám, belmagasság, ráterhelés); a tervben ténylegesen alkalmazott halmozással. A feltételezéseket a „Feltételezések” alatt látja. |
| **B · Fizikai** | A homlokfaltól a legtávolabbi rakományélig lefoglalt hossz. A hézagok és a szélességi maradék is beleszámít. **Nem** a dobozhosszak összege. |
| **C · Díjszámítási** | A FuvarDíj 4.0 szabálya szerint: *maximum / fizikai / tömeg*, kg/LDM index és kerekítés. A beállítások a FuvarDíj 4.0 alapértékei, és a fuvarozónak meg kell erősítenie őket. |

A „Miért tér el a három mutató?” rész megmutatja, mi okozza az eltérést. A mutatók nem azonosak automatikusan.

Az **Ellenőrzés** blokk az ütközést, a határokat, az alátámasztást, a halmozhatóságot, a rétegszámot, a ráterhelést és a teherbírást vizsgálja. Hibánál „⛔”, figyelmeztetésnél „⚠” jelölést kap (pl. homlokfal-hézag, tömöríthető üres sáv, el nem helyezett rakomány). A **Nem ellenőrzött szállításbiztonsági feltételek** listája mindig látszik: tengelyterhelés, súlypont, rögzítés stb. A program ezeket nem vizsgálja.

## 4. Több rakodási terv összehasonlítása
1. Adjon nevet a tervnek, és kattintson a „＋ Mentés új tervként” gombra. Ezt legalább háromszor ismételje meg, különböző elrendezésekkel.
2. A táblázat soronként mutatja: név, fizikai LDM, díjszámítási LDM, elméleti LDM, teljes tömeg, kihasznált alapterület, szabad rakodóterület (teljes, illetve a lefoglalt sávon belül), állapot, korlátozások és figyelmeztetések. Az első sor az aktuális, még nem mentett munkaterület.
3. Rádiógombbal jelölhet ki egy tervet. Ezután használhatja a „Kijelölt felülírása”, „Kijelölt megnyitása a 3D-ben” és „Kijelölt törlése” gombokat. Hibás terv megnyitását a program indoklással elutasítja, de az összehasonlításban a terv megmarad.
4. A tervek ebben a böngészőben is megmaradnak. Tartós mentéshez használja a **Tervek exportálása / importálása** gombokat. Mintának töltse be a `mintatervek/mintatervek_3_valtozat.json` fájlt.

## 5. Árajánlat-előkészítés (FuvarDíj 4.0)
1. Jelölje ki a tervet a táblázatban, és kattintson az **Adatcsomag letöltése** gombra. A csomag tartalma: azonosítók, méretek, tömegek, pozíciók, fizikai és díjszámítási LDM, valamint az ellenőrzési eredmény. **Díjat nem tartalmaz.**
2. Ellenőrzés és árazás a FuvarDíj 4.0 eredeti függvényeivel (a FuvarDíj 4.0 nem módosul):
   ```
   py fuvardij_kapcsolat\fuvardij4_adapter.py csomag.json --fuvardij <FuvarDíj 4.0 mappa>
   py fuvardij_kapcsolat\fuvardij4_adapter.py csomag.json --fuvardij <mappa> --dijparameterek dij.json
   ```
   A `dij.json` a FuvarDíj 4.0 `DijParameterek` mezőit tartalmazza (pl. `dij_per_ldm`, `minimum_dij`, `penznem`), a kalkulátorban ellenőrzött díjszabás szerint. Az `ldm` és az `ossz_kg` értékét a csomag adja, ezeket kézzel nem lehet felülírni.
3. Az adapter **elutasítja** a csomagot, ha:
   - a terv hibás, hiányos, vagy ismeretlen ráterhelésű egységre van halmozva;
   - az LDM eltér a FuvarDíj 4.0 számításától;
   - nincs megadva díjparaméter;
   - a csomagban előre kitöltött ár szerepel.

## Fontos korlátok
- Csak teljes alapterületű alátámasztás megengedett. Áthidalás és részleges alátámasztás nincs.
- Automatikus rakodásoptimalizálás nincs; a 3D-terv kézi.
- A program geometriai és megadott halmozási szabályokat ellenőriz. **Szállításbiztonsági jóváhagyást nem helyettesít.**
