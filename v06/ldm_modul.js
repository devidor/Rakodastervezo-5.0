/*
 * Rakodástervező 3D – LDM-számítási modul (0.5)
 * ------------------------------------------------
 * Önálló, függőség nélküli modul. Böngészőben: window.LDMModul, Node-ban: require('./ldm_modul.js').
 *
 * Belső adatok: MINDEN méret és pozíció egész centiméter, tömeg kg.
 * Koordináták: x = hosszirány a homlokfaltól (0 = pótkocsi eleje), y = szélesség a bal faltól, z = padlótól.
 *
 * Három külön LDM-mutató:
 *   A) Elméleti LDM      – alapterület ÷ (pótkocsi-szélesség × 100), feltüntetett halmozási feltételezéssel.
 *   B) Fizikai LDM       – a 3D elrendezésben a homlokfaltól a legtávolabbi rakományélig lefoglalt hossz.
 *   C) Díjszámítási LDM  – a FuvarDíj 4.0 meglévő szabálya (billing_config.py / ldm_calculator.py) szerint:
 *                          szabály (maximum | fizikai | tömeg), kg/LDM index, kerekítés. Ez JS-tükör;
 *                          a FuvarDíj 4.0 adapter az eredeti Python-függvénnyel újraszámolja és összeveti.
 * A modul soha nem állítja, hogy a három érték azonos; az eltéréseket külön jelzi.
 * Tarifát, díjat, súlyátváltási arányt NEM tartalmaz – a kg/LDM index a FuvarDíj 4.0 módosítható alapértéke.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LDMModul = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERZIO = '0.5.0';

  // --- A FuvarDíj 4.0-ból átvett, ott ellenőrzött beállítások (változatlan feliratokkal) -----------------
  // Forrás: fuvar-kalkulator, feature/fuvardij-4 ág, billing_config.py és trailer_config.py
  const FUVARDIJ4_FORRAS = 'fuvar-kalkulator feature/fuvardij-4: billing_config.py, ldm_calculator.py';
  const KEREKITESI_SZABALYOK = Object.freeze({
    'Nincs kerekítés': null,
    'Felfelé 0,01 LDM-re': ['fel', '0.01'],
    'Felfelé 0,1 LDM-re': ['fel', '0.1'],
    'Felfelé 0,25 LDM-re': ['fel', '0.25'],
    'Felfelé 0,5 LDM-re': ['fel', '0.5'],
    'Matematikai kerekítés 0,1 LDM-re': ['kerekit', '0.1'],
  });
  const ELSZAMOLASI_SZABALYOK = Object.freeze(['maximum', 'fizikai', 'tömeg']);
  const ALAP_ELSZAMOLAS = Object.freeze({ kgPerLdm: 1750, kerekites: 'Nincs kerekítés', szabaly: 'maximum' });
  const ALAP_TEHERBIRAS_KG = 24000;
  const POTKOCSI_TIPUSOK = Object.freeze({
    'Normál': { length: 1360, width: 245, height: 270 },
    'Semi-mega': { length: 1360, width: 245, height: 285 },
    'Mega': { length: 1360, width: 245, height: 300 },
  });

  // Amit a modul NEM ellenőriz – mindig külön feltüntetendő.
  const NEM_ELLENORZOTT_FELTETELEK = Object.freeze([
    'Tengelyterhelés és hosszirányú súlyelosztás',
    'A rakomány súlypontja, borulási és csúszási stabilitása',
    'Rakományrögzítés (pl. EN 12195-1 szerinti rögzítési számítás, spanifer, csúszásgátló, kitámasztás)',
    'Dinamikus terhelés fékezéskor, gyorsításkor és kanyarodáskor',
    'A csomagolás és a raklap tényleges szerkezeti teherbírása (a megadott ráterhelés felhasználói adat)',
    'Részleges alátámasztás, áthidalás – a modul csak teljes alapterületű alátámasztást fogad el',
    'Rakodási és lerakodási sorrend, hozzáférhetőség, ajtónyílás',
    'Kerékdob, ajtókeret, rögzítősín miatti szűkebb tényleges rakodótér (ha nincs külön megadva)',
    'A díjszámítási szabály fuvarozói megerősítése (a FuvarDíj 4.0 beállításai szerint számolva)',
  ]);

  // --- Segédfüggvények ------------------------------------------------------------------------------------
  const isInt = Number.isInteger;
  const hu = (n, d = 2) => Number(n).toLocaleString('hu-HU', { minimumFractionDigits: d, maximumFractionDigits: d });
  const footprint = (b) => (b.rot ? { fl: b.width, fw: b.length } : { fl: b.length, fw: b.width });
  function box3(b) {
    const f = footprint(b);
    return { x0: b.x, x1: b.x + f.fl, y0: b.y, y1: b.y + f.fw, z0: b.z, z1: b.z + b.height };
  }
  const overlap3 = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0 && a.z0 < b.z1 && a.z1 > b.z0;
  const covers = (top, bottom) => top.x0 >= bottom.x0 && top.x1 <= bottom.x1 && top.y0 >= bottom.y0 && top.y1 <= bottom.y1;
  const nev = (b) => (b.label ? `${b.label} (#${b.id})` : `${b.id}. doboz`);

  function mergeIntervals(iv) {
    const s = iv.filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
    const out = [];
    for (const [a, b] of s) {
      if (out.length && a <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], b);
      else out.push([a, b]);
    }
    return out;
  }

  /** Téglalapok uniójának pontos területe (cm²) – koordináta-tömörítéssel, egész aritmetikával. */
  function unionArea(rects) {
    const xs = [...new Set(rects.flatMap((r) => [r.x0, r.x1]))].sort((a, b) => a - b);
    let area = 0;
    for (let i = 0; i + 1 < xs.length; i++) {
      const a = xs[i], b = xs[i + 1];
      const ys = mergeIntervals(rects.filter((r) => r.x0 <= a && r.x1 >= b).map((r) => [r.y0, r.y1]));
      area += (b - a) * ys.reduce((s, [p, q]) => s + q - p, 0);
    }
    return area;
  }

  // --- Bemenet ellenőrzése ----------------------------------------------------------------------------------
  function validateTrailer(t) {
    const h = [];
    for (const [k, n] of [['length', 'hossz'], ['width', 'szélesség'], ['height', 'magasság']])
      if (!isInt(t[k]) || t[k] <= 0) h.push(`A pótkocsi belső ${n}a pozitív egész cm legyen.`);
    if (!(Number.isFinite(t.payloadKg) && t.payloadKg > 0)) h.push('A pótkocsi hasznos teherbírása pozitív szám legyen.');
    return h;
  }
  function validateBox(b) {
    const h = [];
    const n = nev(b);
    for (const k of ['length', 'width', 'height']) if (!isInt(b[k]) || b[k] <= 0) h.push(`${n}: a méret pozitív egész cm legyen.`);
    if (!(Number.isFinite(b.weight) && b.weight > 0)) h.push(`${n}: a tömeg pozitív szám legyen.`);
    if (!isInt(b.maxLayers) || b.maxLayers < 1) h.push(`${n}: a rétegszám legalább 1 egész legyen.`);
    if (b.maxLoadKg !== null && !(Number.isFinite(b.maxLoadKg) && b.maxLoadKg >= 0)) h.push(`${n}: a ráterhelés nemnegatív szám vagy „ismeretlen” legyen.`);
    if (![0, 1].includes(b.rot)) h.push(`${n}: a forgatás 0° vagy 90° lehet.`);
    if (b.placed && ![b.x, b.y, b.z].every(isInt)) h.push(`${n}: a pozíció egész cm legyen.`);
    return h;
  }

  /**
   * Geometriai és halmozási ellenőrzés (egész cm). Minden hibát összegyűjt, nem csak az elsőt.
   * @returns {{ok:boolean, hibak:object[], figyelmeztetesek:object[], tamasz:Map, terheles:Map, reteg:Map}}
   */
  function ellenoriz(trailer, boxes) {
    const hibak = [], figy = [];
    const add = (lista, kod, szoveg, dobozok = []) => lista.push({ kod, szoveg, dobozok });
    for (const s of validateTrailer(trailer)) add(hibak, 'ADAT', s);
    const ids = new Set();
    for (const b of boxes) {
      for (const s of validateBox(b)) add(hibak, 'ADAT', s, [b.id]);
      if (ids.has(b.id)) add(hibak, 'ADAT', `Ismétlődő azonosító: ${b.id}.`, [b.id]);
      ids.add(b.id);
    }
    if (hibak.length) return { ok: false, hibak, figyelmeztetesek: figy, tamasz: new Map(), terheles: new Map(), reteg: new Map() };

    const placed = boxes.filter((b) => b.placed);
    const B = new Map(placed.map((b) => [b.id, box3(b)]));
    for (const b of placed) {
      const v = B.get(b.id);
      if (v.x0 < 0 || v.y0 < 0 || v.z0 < 0 || v.x1 > trailer.length || v.y1 > trailer.width || v.z1 > trailer.height)
        add(hibak, 'HATAR', `${nev(b)} kilóg a ${trailer.length} × ${trailer.width} × ${trailer.height} cm-es rakodótérből.`, [b.id]);
    }
    for (let i = 0; i < placed.length; i++)
      for (let j = i + 1; j < placed.length; j++)
        if (overlap3(B.get(placed[i].id), B.get(placed[j].id)))
          add(hibak, 'UTKOZES', `Ütközés: ${nev(placed[i])} és ${nev(placed[j])}.`, [placed[i].id, placed[j].id]);

    const tamasz = new Map();
    for (const b of placed) {
      const v = B.get(b.id);
      if (v.z0 === 0) continue;
      const under = placed.find((o) => o.id !== b.id && B.get(o.id).z1 === v.z0 && covers(v, B.get(o.id)));
      if (!under) { add(hibak, 'ALATAMASZTAS', `${nev(b)} alatt nincs teljes alapterületű alátámasztás (lebeg vagy részben alátámasztott).`, [b.id]); continue; }
      if (!under.stackable) add(hibak, 'NEM_HALMOZHATO', `${nev(under)} nem halmozható, mégis ${nev(b)} áll rajta.`, [under.id, b.id]);
      tamasz.set(b.id, under.id);
    }
    const terheles = new Map(), reteg = new Map(), byId = new Map(placed.map((b) => [b.id, b]));
    for (const b of placed) {
      let cur = b.id, depth = 0;
      const seen = new Set([cur]);
      while (tamasz.has(cur)) {
        const u = tamasz.get(cur);
        if (seen.has(u)) { add(hibak, 'ALATAMASZTAS', 'Körkörös alátámasztás.', [b.id]); break; }
        seen.add(u); depth++;
        terheles.set(u, (terheles.get(u) || 0) + b.weight);
        reteg.set(u, Math.max(reteg.get(u) || 1, depth + 1));
        cur = u;
      }
    }
    for (const b of placed) {
      const r = reteg.get(b.id) || 1, t = terheles.get(b.id) || 0;
      if (r > b.maxLayers) add(hibak, 'RETEG', `${nev(b)}: ${r} réteg, a megengedett ${b.maxLayers}.`, [b.id]);
      if (b.maxLoadKg === null) { if (t > 0) add(figy, 'NEM_IGAZOLT_TERHELES', `${nev(b)}: ${hu(t, 0)} kg áll rajta, de a megengedett ráterhelés nincs megadva – nem igazolt.`, [b.id]); }
      else if (t > b.maxLoadKg) add(hibak, 'TERHELES', `${nev(b)}: a ráhelyezett ${hu(t, 0)} kg meghaladja a megengedett ${hu(b.maxLoadKg, 0)} kg-ot.`, [b.id]);
    }
    const ossz = placed.reduce((s, b) => s + b.weight, 0);
    if (ossz > trailer.payloadKg) add(hibak, 'TEHERBIRAS', `Az elhelyezett tömeg (${hu(ossz, 0)} kg) túllépi a megadott hasznos teherbírást (${hu(trailer.payloadKg, 0)} kg).`);

    const kint = boxes.filter((b) => !b.placed);
    if (kint.length) add(figy, 'NINCS_ELHELYEZVE', `${kint.length} rakomány nincs elhelyezve – a terv nem teljes, árajánlathoz nem használható.`, kint.map((b) => b.id));
    if (!boxes.length) add(figy, 'URES', 'A terv nem tartalmaz rakományt.');
    if (placed.length) {
      const minX = Math.min(...placed.map((b) => B.get(b.id).x0));
      if (minX > 0) add(figy, 'ELSO_HEZAG', `A rakomány ${minX} cm-re kezdődik a homlokfaltól. A fizikai LDM a homlokfaltól mért, ezért ez a hézag is beszámít.`);
      const iv = mergeIntervals(placed.map((b) => [B.get(b.id).x0, B.get(b.id).x1]));
      for (let i = 0; i + 1 < iv.length; i++)
        add(figy, 'KERESZT_HEZAG', `${iv[i][1]}–${iv[i + 1][0]} cm között ${iv[i + 1][0] - iv[i][1]} cm-es teljes szélességű üres sáv van; a terv tömöríthető.`);
    }
    return { ok: hibak.length === 0, hibak, figyelmeztetesek: figy, tamasz, terheles, reteg };
  }

  // --- A) Elméleti LDM ------------------------------------------------------------------------------------
  /** FuvarDíj 4.0 ldm_calculator.elmeleti_ldm megfelelője: darab × hossz × szélesség ÷ (szélesség × 100). */
  const elmeletiLdm = (darab, hossz, szelesseg, refSzelesseg) => darab * hossz * szelesseg / (refSzelesseg * 100);

  function elmeleti(trailer, boxes) {
    const W = trailer.width, felt = [];
    const nelkul = boxes.reduce((s, b) => s + elmeletiLdm(1, b.length, b.width, W), 0);

    // Adatokból megengedett halmozás (FuvarDíj 4.0 módszer: alapterületi helyek × egységterület).
    const csoportok = new Map();
    for (const b of boxes) {
      const k = JSON.stringify([b.length, b.width, b.height, b.weight, b.stackable, b.maxLayers, b.maxLoadKg]);
      if (!csoportok.has(k)) csoportok.set(k, { minta: b, darab: 0 });
      csoportok.get(k).darab++;
    }
    let adatokbol = 0;
    const reszletek = [];
    for (const { minta: b, darab } of csoportok.values()) {
      let szint = 1, ok = 'nem halmozható';
      if (b.stackable) {
        const magassag = Math.floor(trailer.height / b.height);
        const teher = b.maxLoadKg === null ? 1 : Math.floor(b.maxLoadKg / b.weight + 1e-9) + 1;
        szint = Math.max(1, Math.min(b.maxLayers, magassag, teher));
        ok = b.maxLoadKg === null ? 'ráterhelés ismeretlen → halmozás nem feltételezve'
          : `min(rétegkorlát ${b.maxLayers}, belmagasság ${magassag}, ráterhelés ${teher})`;
        if (b.maxLoadKg === null) felt.push(`${b.length} × ${b.width} × ${b.height} cm tétel: ráterhelés ismeretlen, halmozás nem feltételezve.`);
      }
      const helyek = Math.ceil(darab / szint);
      adatokbol += elmeletiLdm(helyek, b.length, b.width, W);
      reszletek.push({ meret: `${b.length} × ${b.width} × ${b.height} cm`, darab, szint, helyek, indok: ok });
    }

    // A tervben ténylegesen alkalmazott halmozás: padlón álló elhelyezett dobozok + a még kint lévők.
    const tervben = boxes.filter((b) => !b.placed || b.z === 0).reduce((s, b) => s + elmeletiLdm(1, b.length, b.width, W), 0);

    felt.push(`Referencia-szélesség: ${W} cm (a pótkocsi belső szélessége).`);
    felt.push('Területalapú alsó becslés: a doboz forgatását, a köztes hézagokat és a szélességi maradékot nem veszi figyelembe.');
    felt.push('„Adatokból” változat: azonos tételek a megadott réteg-, belmagasság- és ráterhelési korlát szerint halmozva.');
    felt.push('„Terv szerinti” változat: csak a padlón álló (és a még el nem helyezett) egységek alapterülete.');
    return { halmozasNelkul: nelkul, adatokbolHalmozva: adatokbol, tervSzerintiHalmozas: tervben, csoportok: reszletek, feltetelezesek: felt };
  }

  // --- B) Fizikai LDM -------------------------------------------------------------------------------------
  function fizikai(trailer, boxes) {
    const placed = boxes.filter((b) => b.placed).map((b) => ({ b, v: box3(b) }));
    const TL = trailer.length, TW = trailer.width;
    const hasznaltHossz = placed.length ? Math.max(...placed.map((p) => p.v.x1)) : 0;
    const kezdet = placed.length ? Math.min(...placed.map((p) => p.v.x0)) : 0;
    const sav = mergeIntervals(placed.map((p) => [p.v.x0, p.v.x1]));
    const nettoHossz = sav.reduce((s, [a, b]) => s + b - a, 0);
    const alapterulet = unionArea(placed.map((p) => p.v));
    const hasznaltTerulet = hasznaltHossz * TW;
    return {
      ldm: hasznaltHossz / 100,
      hasznaltHosszCm: hasznaltHossz,
      homlokfalHezagCm: kezdet,
      foglaltSavokCm: sav,
      nettoFoglaltHosszCm: nettoHossz,
      dobozHosszOsszegCm: placed.reduce((s, p) => s + p.v.x1 - p.v.x0, 0), // csak összehasonlításra, NEM LDM
      alapteruletCm2: alapterulet,
      hasznaltSavTeruletCm2: hasznaltTerulet,
      szabadTeruletSavbanCm2: hasznaltTerulet - alapterulet,
      szabadTeruletOsszesCm2: TL * TW - alapterulet,
      maradoHosszCm: Math.max(0, TL - hasznaltHossz),
      savKihasznaltsagPct: hasznaltTerulet ? alapterulet / hasznaltTerulet * 100 : 0,
      padloKihasznaltsagPct: alapterulet / (TL * TW) * 100,
      meghatarozas: 'A homlokfaltól (x = 0) a legtávolabbi elhelyezett rakományélig mért hossz ÷ 100. A közbenső és oldalsó szabad helyek beszámítanak, mert más rakomány számára nem használhatók fel hosszirányban.',
    };
  }

  // --- C) Díjszámítási LDM (FuvarDíj 4.0 tükör) ------------------------------------------------------------
  const SCALE = 1000000000n; // 1e-9 kvantálás, mint a FuvarDíj 4.0 kerekit() függvényében
  /** Tizedes szöveg → egész ×1e9, félig párosra kerekítve (Python Decimal.quantize alapértelmezése). */
  function toScaled(x) {
    let s = String(x).toLowerCase(), exp = 0;
    if (s.includes('e')) { const [m, e] = s.split('e'); s = m; exp = Number(e); }
    let [ip, fp = ''] = s.split('.');
    let digits = BigInt(ip + fp), scale = fp.length - exp; // érték = digits × 10^-scale
    if (scale <= 9) return digits * 10n ** BigInt(9 - scale);
    const div = 10n ** BigInt(scale - 9), q = digits / div, r = digits % div;
    return (2n * r > div || (2n * r === div && q % 2n === 1n)) ? q + 1n : q;
  }
  function kerekit(ertek, szabaly) {
    if (!(szabaly in KEREKITESI_SZABALYOK)) throw new Error(`Ismeretlen kerekítési szabály: ${szabaly}`);
    const beall = KEREKITESI_SZABALYOK[szabaly];
    if (beall === null) return ertek;
    const [mod, lepesStr] = beall, V = toScaled(ertek), S = toScaled(lepesStr);
    let q = V / S;
    const r = V % S;
    if (mod === 'fel' ? r > 0n : 2n * r >= S) q += 1n;
    return Number(q * S) / 1e9;
  }
  function elszamolas(fizikaiLdm, osszTomegKg, cfg = ALAP_ELSZAMOLAS) {
    const c = { ...ALAP_ELSZAMOLAS, ...cfg };
    if (!ELSZAMOLASI_SZABALYOK.includes(c.szabaly)) throw new Error('Ismeretlen elszámolási szabály.');
    if (!(Number.isFinite(c.kgPerLdm) && c.kgPerLdm > 0)) throw new Error('Az elszámolási index (kg/LDM) legyen nagyobb 0-nál.');
    if (!(c.kerekites in KEREKITESI_SZABALYOK)) throw new Error(`Ismeretlen kerekítési szabály: ${c.kerekites}`);
    if (![fizikaiLdm, osszTomegKg].every((v) => Number.isFinite(v) && v >= 0)) throw new Error('Az LDM és a tömeg véges, nemnegatív szám legyen.');
    const tomeg = osszTomegKg / c.kgPerLdm;
    const nyers = { maximum: Math.max(fizikaiLdm, tomeg), fizikai: fizikaiLdm, 'tömeg': tomeg }[c.szabaly];
    return {
      fizikaiLdm, tomegalapuLdm: tomeg, nyersLdm: nyers,
      elszamolasiLdm: kerekit(nyers, c.kerekites),
      meghatarozo: c.szabaly === 'maximum' ? (tomeg > fizikaiLdm ? 'tömeg' : 'fizikai') : c.szabaly,
      kgPerLdm: c.kgPerLdm, kerekites: c.kerekites, szabaly: c.szabaly,
      forras: FUVARDIJ4_FORRAS,
    };
  }

  // --- Összesített elemzés -----------------------------------------------------------------------------------
  function elemzes(terv) {
    const { trailer, boxes } = terv;
    const cfg = { ...ALAP_ELSZAMOLAS, ...(terv.elszamolas || {}) };
    const ell = ellenoriz(trailer, boxes);
    const adatHiba = ell.hibak.some((h) => h.kod === 'ADAT');
    const el = adatHiba ? null : elmeleti(trailer, boxes);
    const fiz = adatHiba ? null : fizikai(trailer, boxes);
    const elhelyezettTomeg = boxes.filter((b) => b.placed).reduce((s, b) => s + b.weight, 0);
    const osszTomeg = boxes.reduce((s, b) => s + b.weight, 0);
    let dij = null, dijHiba = null;
    try { if (fiz) dij = elszamolas(fiz.ldm, elhelyezettTomeg, cfg); } catch (e) { dijHiba = e.message; }
    const elteresek = [];
    if (el && fiz && dij) {
      const d = (a, b) => Math.abs(a - b) > 1e-9;
      if (d(fiz.ldm, el.adatokbolHalmozva)) elteresek.push(`Fizikai (${hu(fiz.ldm)}) ≠ elméleti (${hu(el.adatokbolHalmozva)}) LDM: az elrendezés hézagai, a szélességi maradék és a ténylegesen alkalmazott halmozás okozza.`);
      if (d(dij.elszamolasiLdm, fiz.ldm)) elteresek.push(`Díjszámítási (${hu(dij.elszamolasiLdm)}) ≠ fizikai (${hu(fiz.ldm)}) LDM: meghatározó tényező: ${dij.meghatarozo}${dij.kerekites !== 'Nincs kerekítés' ? ', kerekítés: ' + dij.kerekites : ''}.`);
      if (!elteresek.length) elteresek.push('A mutatók ebben a tervben számszerűen egyeznek, de ez nem általános szabály: más elrendezésnél vagy díjszabásnál eltérhetnek.');
    }
    const teljes = boxes.length > 0 && boxes.every((b) => b.placed);
    // A FuvarDíj 4.0-hoz igazodva: hibás, hiányos vagy nem igazolt ráterhelésű tervből nincs ajánlat.
    const akadalyok = [];
    if (!ell.ok) akadalyok.push('A terv nem felel meg a geometriai / halmozási szabályoknak.');
    if (!teljes) akadalyok.push('Nincs minden rakomány elhelyezve.');
    if (ell.figyelmeztetesek.some((f) => f.kod === 'NEM_IGAZOLT_TERHELES')) akadalyok.push('Halmozás ismeretlen ráterhelésű egységen – nem igazolt.');
    if (!dij) akadalyok.push('A díjszámítási LDM nem számolható.');
    return {
      ellenorzes: ell, elmeleti: el, fizikai: fiz, dijszamitas: dij, dijHiba,
      osszTomegKg: osszTomeg, elhelyezettTomegKg: elhelyezettTomeg,
      darab: boxes.length, elhelyezettDarab: boxes.filter((b) => b.placed).length,
      teljes, megfelel: ell.ok, ajanlatraAlkalmas: akadalyok.length === 0, ajanlatAkadalyok: akadalyok,
      elteresek, nemEllenorzott: NEM_ELLENORZOTT_FELTETELEK.slice(),
    };
  }

  /** Több terv összehasonlító táblázata. */
  function osszehasonlit(tervek) {
    return tervek.map((t) => {
      const a = elemzes(t);
      const korl = [...a.ellenorzes.hibak.map((h) => '⛔ ' + h.szoveg), ...a.ellenorzes.figyelmeztetesek.map((f) => '⚠ ' + f.szoveg)];
      return {
        nev: t.nev, elemzes: a,
        fizikaiLdm: a.fizikai ? a.fizikai.ldm : null,
        dijszamitasiLdm: a.dijszamitas ? a.dijszamitas.elszamolasiLdm : null,
        elmeletiLdm: a.elmeleti ? a.elmeleti.adatokbolHalmozva : null,
        osszTomegKg: a.osszTomegKg,
        kihasznaltAlapteruletM2: a.fizikai ? a.fizikai.alapteruletCm2 / 1e4 : null,
        padloKihasznaltsagPct: a.fizikai ? a.fizikai.padloKihasznaltsagPct : null,
        szabadTeruletM2: a.fizikai ? a.fizikai.szabadTeruletOsszesCm2 / 1e4 : null,
        szabadTeruletSavbanM2: a.fizikai ? a.fizikai.szabadTeruletSavbanCm2 / 1e4 : null,
        megfelel: a.megfelel, ajanlatraAlkalmas: a.ajanlatraAlkalmas, korlatozasok: korl,
      };
    });
  }

  // --- FuvarDíj 4.0 adatcsomag --------------------------------------------------------------------------------
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }
  const r6 = (x) => Math.round(x * 1e6) / 1e6;

  function fuvardijCsomag(terv, letrehozva = new Date().toISOString()) {
    const a = elemzes(terv), { trailer, boxes } = terv;
    const tamasz = a.ellenorzes.tamasz;
    const rakomanyok = boxes.map((b) => {
      const f = footprint(b);
      return {
        azonosito: b.label || `D${String(b.id).padStart(3, '0')}`,
        belso_id: b.id,
        tipus: b.type || 'Egyéb',
        szin: b.color || null,
        hossz_cm: b.length, szelesseg_cm: b.width, magassag_cm: b.height,
        tomeg_kg: b.weight,
        forgatva_90: b.rot === 1,
        alapterulet_hossz_cm: f.fl, alapterulet_szelesseg_cm: f.fw,
        halmozhato: !!b.stackable, max_retegszam: b.maxLayers,
        max_raterheles_kg: b.maxLoadKg,
        elhelyezve: !!b.placed,
        pozicio_cm: b.placed ? { x: b.x, y: b.y, z: b.z } : null,
        alatta_levo_belso_id: tamasz.get(b.id) ?? null,
      };
    });
    const tervAzonosito = fnv1a(JSON.stringify([trailer, boxes.map((b) => [b.id, b.length, b.width, b.height, b.weight, b.rot, b.placed, b.x, b.y, b.z, b.stackable, b.maxLayers, b.maxLoadKg]), terv.elszamolas || {}]));
    return {
      format: 'fuvardij4-rakodasi-csomag',
      verzio: 1,
      letrehozva,
      forras: { alkalmazas: 'Rakodástervező 3D', verzio: '0.5', ldm_modul: VERZIO },
      terv: { nev: terv.nev || 'Névtelen terv', azonosito: tervAzonosito },
      mertekegysegek: { hossz: 'cm', tomeg: 'kg', ldm: 'm (rakodóméter)', koordinatak: 'x: homlokfaltól, y: bal faltól, z: padlótól' },
      potkocsi: { tipus: trailer.type || 'Egyedi méret', hossz_cm: trailer.length, szelesseg_cm: trailer.width, magassag_cm: trailer.height, teherbiras_kg: trailer.payloadKg },
      rakomanyok,
      osszesites: { darab: a.darab, elhelyezett_darab: a.elhelyezettDarab, ossz_tomeg_kg: a.osszTomegKg, elhelyezett_tomeg_kg: a.elhelyezettTomegKg },
      ldm: {
        elmeleti_halmozas_nelkul: a.elmeleti ? r6(a.elmeleti.halmozasNelkul) : null,
        elmeleti_adatokbol_halmozva: a.elmeleti ? r6(a.elmeleti.adatokbolHalmozva) : null,
        elmeleti_terv_szerinti_halmozas: a.elmeleti ? r6(a.elmeleti.tervSzerintiHalmozas) : null,
        elmeleti_feltetelezesek: a.elmeleti ? a.elmeleti.feltetelezesek : [],
        fizikai: a.fizikai ? a.fizikai.ldm : null,
        fizikai_hasznalt_hossz_cm: a.fizikai ? a.fizikai.hasznaltHosszCm : null,
        fizikai_meghatarozas: a.fizikai ? a.fizikai.meghatarozas : null,
        dijszamitasi: a.dijszamitas ? a.dijszamitas.elszamolasiLdm : null,
        megjegyzes: 'A három mutató eltérhet; egyezésük nem automatikus.',
      },
      dijszamitas: a.dijszamitas ? {
        // A kulcsok a FuvarDíj 4.0 ElszamolasiKonfig mezőinek felelnek meg.
        kg_per_ldm: a.dijszamitas.kgPerLdm, kerekites: a.dijszamitas.kerekites, szabaly: a.dijszamitas.szabaly,
        tomegalapu_ldm: a.dijszamitas.tomegalapuLdm, meghatarozo: a.dijszamitas.meghatarozo,
        szamitas_alapja: 'elhelyezett tömeg és fizikai LDM',
        forras: a.dijszamitas.forras + ' (JS-tükör; a FuvarDíj 4.0 adapter újraszámolja)',
        fuvarozo_megerositette: false,
      } : null,
      ellenorzes: {
        megfelel: a.megfelel,
        hibak: a.ellenorzes.hibak.map((h) => ({ kod: h.kod, szoveg: h.szoveg })),
        figyelmeztetesek: a.ellenorzes.figyelmeztetesek.map((h) => ({ kod: h.kod, szoveg: h.szoveg })),
        nem_ellenorzott_feltetelek: a.nemEllenorzott,
      },
      ajanlatra_alkalmas: a.ajanlatraAlkalmas,
      ajanlat_akadalyai: a.ajanlatAkadalyok,
      arazas: null,
      arazas_megjegyzes: 'A csomag nem tartalmaz díjat vagy tarifát. Az árat kizárólag a FuvarDíj 4.0 meglévő díjszabási logikája (pricing.szamol_dij) számolhatja ki.',
    };
  }

  return {
    VERZIO, KEREKITESI_SZABALYOK, ELSZAMOLASI_SZABALYOK, ALAP_ELSZAMOLAS, ALAP_TEHERBIRAS_KG, POTKOCSI_TIPUSOK,
    NEM_ELLENORZOTT_FELTETELEK, FUVARDIJ4_FORRAS,
    footprint, box3, unionArea, ellenoriz, elmeletiLdm, elmeleti, fizikai, kerekit, elszamolas, elemzes, osszehasonlit, fuvardijCsomag,
  };
});
