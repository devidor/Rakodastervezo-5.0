/*
 * Rakománytervező 3D V07 – sérülésmentességi szabályok és teljes (profi) ellenőrzés
 * ---------------------------------------------------------------------------------
 * Ráépül: ellenorzo.js (geometria, ütközés, halmozás – több egységen átívelő alátámasztással), lerakodas.js
 * (átrakás nélküli lerakodás, kezelhetőség, idő), jarmu.js (tengelyterhelés, terhelési diagram).
 *
 * FONTOS: a program a megadott adatok alapján a MODELLEZETT szabályokat ellenőrzi. A rögzítési számítás
 * EN 12195-1 elvein alapuló BECSLÉS, nem tanúsítvány; a tényleges rögzítés a rakodást végző felelőssége.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./ldm_modul.js'), require('./ellenorzo.js'), require('./jarmu.js'), require('./lerakodas.js'));
  else root.Biztonsag = factory(root.LDMModul, root.Ellenorzo, root.Jarmu, root.Lerakodas);
})(typeof self !== 'undefined' ? self : this, function (LDM, E, J, L) {
  'use strict';

  const NYILATKOZAT = 'A terv a megadott adatok alapján a modellezett szabályoknak megfelel. A tényleges rögzítés és a rakomány állapota a rakodást végző felelőssége; a program nem ad hatósági vagy EN 12195-1 szerinti minősítést.';

  /** Alapbeállítások (mind konfigurálható). */
  const ALAP = Object.freeze({
    nehezKonnyuTuresPct: 0, tamaszAranyPct: 90, tamaszAranyTorekenyPct: 100, borulasArany: 2.0,
    keresztTuresPct: 5, keresztAlap: 'jarmu', sulypontMagasPct: 50, hezagMenetCm: 5, hezagOldalCm: 5, tetoResCm: 2,
    kezelesRahagyasCm: 10, oldalRahagyasCm: 0, keziMaxMagassagCm: 180,
    gyorsulas: { elore: 0.8, oldal: 0.5, hatra: 0.5, fuggoleges: 1.0 }, stfDaN: 400, biztonsagiTenyezo: { elore: 1.25, oldal: 1.1, hatra: 1.1 },
    idok: { targonca: 90, beka: 120, kezi: 20, daru: 180 }, melysegSpM: 4, szintPotlekS: 20, atrakasBuntetesS: 120,
  });

  const TOREKENYSEG = Object.freeze({ nem: 'nem törékeny', kozepes: 'közepesen törékeny', torekeny: 'törékeny', nagyon_torekeny: 'nagyon törékeny' });
  const RANG = { nem: 0, kozepes: 1, torekeny: 2, nagyon_torekeny: 3 };
  const CSOMAGOLAS = Object.freeze({
    eur_raklap: { nev: 'EUR-raklap', kezeles: 'targonca', villairany: 'mindket', meret: [120, 80] },
    ind_raklap: { nev: 'Ipari raklap', kezeles: 'targonca', villairany: 'mindket', meret: [120, 100] },
    fel_raklap: { nev: 'Félraklap', kezeles: 'beka', villairany: 'mindket', meret: [80, 60] },
    doboz: { nev: 'Doboz', kezeles: 'kezi', villairany: 'mindket' },
    lada: { nev: 'Láda', kezeles: 'targonca', villairany: 'mindket' },
    ibc: { nev: 'IBC-tartály', kezeles: 'targonca', villairany: 'mindket', meret: [120, 100] },
    hordo: { nev: 'Hordó', kezeles: 'kezi', villairany: 'mindket' },
    tekercs: { nev: 'Tekercs', kezeles: 'targonca', villairany: 'hossz' },
    gitterbox: { nev: 'Gitterbox', kezeles: 'targonca', villairany: 'mindket', meret: [124, 84] },
    bigbag: { nev: 'Big bag', kezeles: 'targonca', villairany: 'mindket' },
    gep: { nev: 'Gép / egyedi', kezeles: 'daru', villairany: 'mindket' },
    egyeb: { nev: 'Egyéb', kezeles: 'kezi', villairany: 'mindket' },
  });
  /** V06 rakománytípus-nevek → V07 csomagolás. */
  const TIPUS_CSOMAGOLAS = { 'EUR-raklap': 'eur_raklap', 'Ipari raklap': 'ind_raklap', 'Félraklap': 'fel_raklap', 'Doboz': 'doboz', 'Láda': 'lada', 'Gitterbox': 'gitterbox', 'Hordó': 'hordo', 'Big bag': 'bigbag', 'Gép / egyedi': 'gep', 'Egyéb': 'egyeb', 'IBC-tartály': 'ibc', 'Tekercs': 'tekercs' };

  /** V07 hibakódok: szöveg és súlyosság (kemény = a terv érvénytelen). */
  const KODOK = Object.freeze({
    TOREKENY_HALMOZAS: { szoveg: 'Törékeny egységre csak legalább ugyanolyan törékeny és nem nehezebb egység kerülhet; nagyon törékenyre semmi', kemeny: true },
    NEHEZ_KONNYUN: { szoveg: 'Nehezebb egység könnyebb alátámasztáson', kemeny: true },
    FELULETI_NYOMAS: { szoveg: 'A felületi nyomás meghaladja az alsó egység terhelhetőségét', kemeny: true },
    BORULAS: { szoveg: 'Borulásveszélyes, egyik oldalról sem megtámasztott oszlop', kemeny: true },
    BORULAS_ROGZITES: { szoveg: 'Csak egy oldalon megtámasztott magas oszlop – borulás elleni rögzítés szükséges', kemeny: false },
    SULYPONT_HOSSZ: { szoveg: 'A súlypont hosszirányban a terhelési diagramon kívül esik', kemeny: true },
    SULYPONT_KERESZT: { szoveg: 'A súlypont keresztirányban a megengedett sávon kívül', kemeny: true },
    SULYPONT_MAGAS: { szoveg: 'Magasan fekvő súlypont', kemeny: false },
    TENGELYTERHELES: { szoveg: 'Tengely túlterhelése', kemeny: true },
    KORMANYZOTT_TENGELY: { szoveg: 'A kormányzott tengely terhelése a minimum alatt', kemeny: true },
    HEZAG_MENETIRANY: { szoveg: 'Hézag menetirányban – kitöltés vagy rögzítés szükséges', kemeny: false },
    HEZAG_OLDAL: { szoveg: 'Hézag oldalirányban – kitöltés vagy rögzítés szükséges', kemeny: false },
    ROGZITES_ELEGTELEN: { szoveg: 'A fal- és súrlódási megtámasztás nem elég, lekötés szükséges (becslés)', kemeny: false },
    AJTO_MERET: { szoveg: 'Az egység nem fér át az ajtón', kemeny: true },
    TETO_RES: { szoveg: 'Nincs meg a tető alatti szabad magasság', kemeny: true },
    ALLO_FORDITVA: { szoveg: '„Ez a vége felfelé” egység eldöntve', kemeny: true },
    ADR_ELKULONITES: { szoveg: 'Eltérő ADR-osztályú áruk egy rakodótérben – együvé rakási tilalmat ellenőrizni kell', kemeny: false },
    LERAKO_SORREND: { szoveg: 'Lerakodáskor átrakást igénylő elhelyezés', kemeny: true },
    KEZELES_IRANY: { szoveg: 'A villanyílás nem a kivételi irány felé néz', kemeny: true },
    KEZI_MAGASSAG: { szoveg: 'Kézi egység túl magasan', kemeny: false },
    LERAKO_SZIGET: { szoveg: 'Egy lerakó egységei nem egy tömbben', kemeny: false },
    NEM_IGAZOLT_TOMEG: { szoveg: 'A tömeg nincs megadva / nem igazolt', kemeny: false },
  });
  /** Kézi elhelyezéskor azonnal blokkoló szabályok (az egész tervre vonatkozók – súlypont, tengely, sorrend – csak jelzést adnak). */
  const KEZI_BLOKKOLO = new Set(['TOREKENY_HALMOZAS', 'NEHEZ_KONNYUN', 'FELULETI_NYOMAS', 'AJTO_MERET', 'TETO_RES', 'ALLO_FORDITVA', 'KEZELES_IRANY']);

  const rang = (u) => RANG[u.torekenyseg] ?? 0;
  /** V07 egységmezők kiegészítése alapértékekkel (az eredeti objektum nem változik). */
  function egyseg07(u) {
    const cs = CSOMAGOLAS[u.csomagolas] ? u.csomagolas : TIPUS_CSOMAGOLAS[u.type] || 'doboz';
    const def = CSOMAGOLAS[cs];
    return {
      ...u,
      csomagolas: cs,
      torekenyseg: TOREKENYSEG[u.torekenyseg] ? u.torekenyseg : 'nem',
      maxNyomasKgM2: Number.isFinite(u.maxNyomasKgM2) && u.maxNyomasKgM2 > 0 ? u.maxNyomasKgM2 : null,
      allo: u.allo !== false,
      billentheto: u.billentheto === true,
      kezeles: L.KEZELES[u.kezeles] ? u.kezeles : (def.kezeles === 'kezi' && u.weight > 30 ? 'beka' : def.kezeles),
      villairany: ['hossz', 'szel', 'mindket'].includes(u.villairany) ? u.villairany : def.villairany,
      lerakoOldal: L.OLDALAK[u.lerakoOldal] ? u.lerakoOldal : null,
      cimzett: typeof u.cimzett === 'string' ? u.cimzett : '', rendelesSzam: typeof u.rendelesSzam === 'string' ? u.rendelesSzam : '',
      adrOsztaly: u.adrOsztaly ? String(u.adrOsztaly).slice(0, 8) : null,
      tomegIgazolt: u.tomegIgazolt !== false,
      billentve: typeof u.billentve === 'string' && u.billentve ? u.billentve : null,
    };
  }
  /** Felületi nyomás határa (kg/m²): megadott érték, vagy a felső terhelhetőség ÷ alapterület. null = ismeretlen. */
  const nyomasHatar = (u) => (u.maxNyomasKgM2 ?? (u.maxLoadKg != null ? u.maxLoadKg / ((u.length * u.width) / 1e4) : null));
  const tamaszArany = (u, C) => (rang(u) >= 2 ? C.tamaszAranyTorekenyPct : C.tamaszAranyPct) / 100;
  const nev = (b) => (b.label ? `${b.label} (#${b.id})` : `${b.id}. doboz`);
  const hu = (n, d = 0) => Number(n).toLocaleString('hu-HU', { maximumFractionDigits: d });
  const yz = (a, b) => a.y0 < b.y1 && a.y1 > b.y0 && a.z0 < b.z1 && a.z1 > b.z0;
  const xz = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;

  /** Beállítások összefésülése. */
  const beallitas = (cfg = {}) => ({ ...ALAP, ...cfg, gyorsulas: { ...ALAP.gyorsulas, ...(cfg.gyorsulas || {}) }, idok: { ...ALAP.idok, ...(cfg.idok || {}) }, biztonsagiTenyezo: { ...ALAP.biztonsagiTenyezo, ...(cfg.biztonsagiTenyezo || {}) } });

  /** Blokkoltság láncban (fal vagy blokkolt szomszéd tűrésen belül) egy irányban. */
  function blokkolt(placed, V, irany, t, tur) {
    const ok = new Set();
    const sorted = placed.slice().sort((a, b) => {
      const A = V.get(a.id), B = V.get(b.id);
      return irany === 'elore' ? A.x0 - B.x0 : irany === 'hatra' ? B.x1 - A.x1 : irany === 'bal' ? A.y0 - B.y0 : B.y1 - A.y1;
    });
    for (const p of sorted) {
      const v = V.get(p.id);
      let b = false;
      if (irany === 'elore') b = v.x0 <= tur;
      else if (irany === 'hatra') b = t.length - v.x1 <= tur;
      else if (irany === 'bal') b = v.y0 <= tur;
      else b = t.width - v.y1 <= tur;
      if (!b) for (const id of ok) {
        const w = V.get(id);
        if (irany === 'elore' && w.x1 <= v.x0 && v.x0 - w.x1 <= tur && yz(v, w)) { b = true; break; }
        if (irany === 'hatra' && w.x0 >= v.x1 && w.x0 - v.x1 <= tur && yz(v, w)) { b = true; break; }
        if (irany === 'bal' && w.y1 <= v.y0 && v.y0 - w.y1 <= tur && xz(v, w)) { b = true; break; }
        if (irany === 'jobb' && w.y0 >= v.y1 && w.y0 - v.y1 <= tur && xz(v, w)) { b = true; break; }
      }
      if (b) ok.add(p.id);
    }
    return ok;
  }

  /**
   * Rögzítési becslés (EN 12195-1 elvei, leszorító lekötés). Tájékoztató érték.
   * Blokkolt tömeg: a fal (homlokfal / oldalfal / ajtó) a teherbírása erejéig felveszi; a nem blokkolt tömeghez és a
   * fal kapacitása feletti részhez lekötőpánt kell: n ≥ m·g·(c − μ·c_z) ÷ (2·μ·sin α·STF) × f_s.
   */
  function rogzites(t, P, C, placed, V, hezag) {
    const g = 9.81, mu = P.mu, stf = C.stfDaN * 10, tur = Math.max(C.hezagMenetCm, C.hezagOldalCm);
    const m = placed.reduce((s, b) => s + b.weight, 0);
    const kap = (tipus, irany) => {
      const p = t.payloadKg * g;
      if (irany === 'elore') return tipus === 'XL' ? 0.5 * p : Math.min(0.4 * p, 50000);
      if (irany === 'hatra') return tipus === 'XL' ? 0.3 * p : 0.25 * p;
      if (P.oldalNyithato && tipus !== 'XL') return 0; // L-es függöny nem teherhordó
      return tipus === 'XL' ? 0.4 * p : 0.3 * p;
    };
    // sin α: a pánt a rakomány tetejéről a fal melletti rögzítőpontig fut.
    const mag = placed.length ? placed.reduce((s, b) => s + V.get(b.id).z1, 0) / placed.length : 100;
    const oldalRes = hezag.atlagOldalCm + 5;
    const sinA = mag / Math.sqrt(mag * mag + oldalRes * oldalRes);
    const iranyok = [];
    const szamol = (irany, c, blokkSet, falKap, fs) => {
      if (!placed.length) return { irany, n: 0 };
      const blokkM = placed.filter((b) => blokkSet.has(b.id)).reduce((s, b) => s + b.weight, 0), szabadM = m - blokkM;
      const ero = (kg) => Math.max(0, kg * g * (c - mu * C.gyorsulas.fuggoleges));
      const blokkEro = ero(blokkM), tobblet = Math.max(0, blokkEro - falKap);
      const kell = ero(szabadM) + tobblet;
      const n = kell > 0 ? Math.ceil((kell / (2 * mu * sinA * stf)) * fs) : 0;
      const r = { irany, gyorsulas: c, blokkoltKg: blokkM, szabadKg: szabadM, falKapacitasN: falKap, szuksegesEroN: kell, n };
      iranyok.push(r); return r;
    };
    const el = szamol('előre', C.gyorsulas.elore, blokkolt(placed, V, 'elore', t, tur), kap(P.homlokfal, 'elore'), C.biztonsagiTenyezo.elore);
    const bal = blokkolt(placed, V, 'bal', t, tur), jobb = blokkolt(placed, V, 'jobb', t, tur);
    const oldalBlokk = new Set([...bal].filter((id) => jobb.has(id)));
    const ol = szamol('oldalra', C.gyorsulas.oldal, oldalBlokk, kap(P.oldalfal, 'oldal'), C.biztonsagiTenyezo.oldal);
    const ha = szamol('hátra', C.gyorsulas.hatra, blokkolt(placed, V, 'hatra', t, tur), kap(P.oldalfal === 'XL' ? 'XL' : 'L', 'hatra'), C.biztonsagiTenyezo.hatra);
    const n = Math.max(el.n || 0, ol.n || 0, ha.n || 0);
    // Pánthelyek: a rakott hossz mentén egyenletesen, a rögzítőpont-osztáshoz igazítva.
    const helyek = [];
    if (n > 0) {
      const x0 = Math.min(...placed.map((b) => V.get(b.id).x0)), x1 = Math.max(...placed.map((b) => V.get(b.id).x1));
      const koz = P.rogzitoKozCm || 100;
      for (let i = 0; i < n; i++) {
        const x = x0 + ((i + 0.5) * (x1 - x0)) / n;
        helyek.push(Math.min(t.length - 5, Math.max(5, Math.round(x / koz) * koz || x)));
      }
    }
    const egyedi = [...new Set(helyek)].sort((a, b) => a - b);
    // Ha az osztás miatt egybeesnek, a többit a köztes rögzítőpontokra tesszük.
    while (egyedi.length < n) { const x = egyedi.length ? egyedi[egyedi.length - 1] + (P.rogzitoKozCm || 100) / 2 : 50; egyedi.push(Math.min(t.length - 5, x)); }
    const csuszasgatloJavasolt = !P.csuszasgatlo && mu < C.gyorsulas.oldal && (ol.n > 0 || ha.n > 0);
    return {
      becsles: true, mu, stfDaN: C.stfDaN, sinAlfa: sinA, iranyok, pantDb: n, pantHelyekX: egyedi.slice(0, n), elvedoDb: n * 2,
      csuszasgatloJavasolt, pantTeherbirasDaN: C.stfDaN,
      megjegyzes: 'EN 12195-1 elvein alapuló becslés (leszorító lekötés, egyenletes eloszlás feltételezésével). Nem tanúsítvány.',
    };
  }

  /**
   * Teljes V07-ellenőrzés.
   * @param {{trailer:object, boxes:object[]}} terv  egész cm, homlokfaltól
   * @param {object} cfg  ALAP felülírásai
   * @returns {object} ok, hibak, figyelmeztetesek, nemIgazolt, allapot, mutatok (súlypont, tengelyek, rögzítés, lerakodás, hézagok, tartalék)
   */
  function ellenoriz(terv, cfg = {}, opt = {}) {
    const C = beallitas(cfg), t = terv.trailer, P = J.profil(t);
    const boxes = terv.boxes.map(egyseg07);
    const e = E.ellenoriz({ trailer: t, boxes }, { sorrend: false, tobbTamasz: { arany: (u) => tamaszArany(u, C) } });
    const hibak = e.hibak.slice(), figy = e.figyelmeztetesek.filter((f) => f.kod !== 'LERAKO_SORREND'), nemIgazolt = [];
    const add = (lista, kod, szoveg, dobozok = []) => lista.push({ kod, szoveg, dobozok });
    const out = { ok: false, hibak, figyelmeztetesek: figy, nemIgazolt, alap: e, profil: P, beallitas: C, mutatok: null };
    if (hibak.some((h) => h.kod === 'ADAT')) { out.allapot = E.ALLAPOT.ERVENYTELEN; return out; }
    const placed = boxes.filter((b) => b.placed).map((b) => ({ ...E.normalizal(b), ...b }));
    const byId = new Map(placed.map((b) => [b.id, b]));
    const V = new Map(placed.map((b) => [b.id, LDM.box3(b)]));
    const tamaszok = e.tamaszok || new Map([...e.tamasz].map(([k, v]) => [k, [{ id: v, arany: 1, terulet: 0 }]]));
    const terheles = e.terheles || new Map();

    // --- 1–3. Halmozás: törékenység, nehéz a könnyűn, felületi nyomás -----------------------------------------
    for (const [fid, lista] of tamaszok) {
      const f = byId.get(fid); if (!f) continue;
      const sumW = lista.reduce((s, a) => s + byId.get(a.id).weight, 0);
      for (const a of lista) {
        const s = byId.get(a.id);
        if (rang(s) === 3) add(hibak, 'TOREKENY_HALMOZAS', `${nev(s)} nagyon törékeny, mégis ${nev(f)} áll rajta.`, [s.id, f.id]);
        else if (rang(s) >= 1 && (rang(f) < rang(s) || f.weight > s.weight)) add(hibak, 'TOREKENY_HALMOZAS', `${nev(s)} (${TOREKENYSEG[s.torekenyseg]}) tetején ${nev(f)} (${TOREKENYSEG[f.torekenyseg]}, ${hu(f.weight, 1)} kg) áll – törékenyre csak legalább ugyanolyan törékeny és nem nehezebb egység kerülhet.`, [s.id, f.id]);
        const hatar = nyomasHatar(s);
        const fv = V.get(f.id), sv = V.get(s.id);
        const ter = a.terulet || Math.max(1, (Math.min(fv.x1, sv.x1) - Math.max(fv.x0, sv.x0)) * (Math.min(fv.y1, sv.y1) - Math.max(fv.y0, sv.y0)));
        if (hatar != null) {
          const nyomas = ((f.weight + (terheles.get(f.id) || 0)) * (a.arany ?? 1)) / (ter / 1e4);
          if (nyomas > hatar * 1.0001) add(hibak, 'FELULETI_NYOMAS', `${nev(s)} felületén ${hu(nyomas)} kg/m² nyomás ébred (${nev(f)} és ami rajta van), a megengedett ${hu(hatar)} kg/m².`, [s.id, f.id]);
        }
      }
      if (f.weight > sumW * (1 + C.nehezKonnyuTuresPct / 100) + 1e-9) add(hibak, 'NEHEZ_KONNYUN', `${nev(f)} (${hu(f.weight, 1)} kg) nehezebb az alátámasztásánál (${hu(sumW, 1)} kg) – nehéz alulra, könnyű felülre.`, [f.id, ...lista.map((a) => a.id)]);
    }
    // --- Állás, ajtó, tető, ADR, tömeg ----------------------------------------------------------------------
    for (const b of placed) {
      const v = V.get(b.id), old = L.oldal(b, C);
      if (b.billentve && (b.allo || !b.billentheto)) add(hibak, 'ALLO_FORDITVA', `${nev(b)} „Ez a vége felfelé” jelzésű (vagy nem billenthető), mégis el van döntve.`, [b.id]);
      if (old === 'hatso' && (v.y1 - v.y0 > P.ajtoSzelessegCm || v.z1 - v.z0 > P.ajtoMagassagCm)) add(hibak, 'AJTO_MERET', `${nev(b)} keresztmetszete ${v.y1 - v.y0} × ${v.z1 - v.z0} cm, az ajtónyílás ${P.ajtoSzelessegCm} × ${P.ajtoMagassagCm} cm.`, [b.id]);
      if ((old === 'bal' || old === 'jobb') && !P.oldalNyithato) add(hibak, 'AJTO_MERET', `${nev(b)} oldalról lenne lerakva, de a jármű oldala nem nyitható.`, [b.id]);
      if (v.z1 > t.height - C.tetoResCm) add(hibak, 'TETO_RES', `${nev(b)} teteje ${v.z1} cm-en van; a tető alatt legalább ${C.tetoResCm} cm szabad hely kell (max. ${t.height - C.tetoResCm} cm).`, [b.id]);
      if (!b.tomegIgazolt) nemIgazolt.push({ kod: 'NEM_IGAZOLT_TOMEG', szoveg: `${nev(b)}: a tömeg nincs igazolva – a számítás a legszigorúbb feltételezéssel él (rá semmi nem kerülhet).`, dobozok: [b.id] });
    }
    for (const b of boxes.filter((q) => !q.placed && !q.tomegIgazolt)) nemIgazolt.push({ kod: 'NEM_IGAZOLT_TOMEG', szoveg: `${nev(b)}: a tömeg nincs igazolva.`, dobozok: [b.id] });
    for (const [fid, lista] of tamaszok) for (const a of lista) if (!byId.get(a.id).tomegIgazolt) add(hibak, 'NEHEZ_KONNYUN', `${nev(byId.get(a.id))} tömege nem igazolt, ezért rá nem kerülhet egység (${nev(byId.get(fid))}).`, [a.id, fid]);
    const adr = placed.filter((b) => b.adrOsztaly);
    if (new Set(adr.map((b) => b.adrOsztaly)).size > 1) add(figy, 'ADR_ELKULONITES', `Eltérő ADR-osztályok egy rakodótérben (${[...new Set(adr.map((b) => b.adrOsztaly))].join(', ')}). Az együvé rakási tilalmakat (ADR 7.5.2) külön ellenőrizni kell – a program teljes ADR-ellenőrzést nem végez.`, adr.map((b) => b.id));

    if (opt.csakHelyi) { // kézi mozgatás közben: csak a helyi (egységenkénti) szabályok – gyors
      for (const b of placed) if (!L.villaOk(b, L.oldal(b, C))) add(hibak, 'KEZELES_IRANY', `${nev(b)}: a villanyílás nem a kivételi irány (${L.OLDALAK[L.oldal(b, C)]}) felé néz – forgasd el 90°-kal.`, [b.id]);
      out.ok = hibak.length === 0; out.allapot = out.ok ? E.ALLAPOT.ERVENYES : E.ALLAPOT.ERVENYTELEN;
      out.mutatok = { terheles, szint: e.szint, tamaszok };
      return out;
    }
    // --- 4. Borulás: önállóan álló oszlopok -----------------------------------------------------------------
    const unio = new Map(placed.map((b) => [b.id, b.id]));
    const gyoker = (a) => { while (unio.get(a) !== a) { unio.set(a, unio.get(unio.get(a))); a = unio.get(a); } return a; };
    for (const [fid, lista] of tamaszok) for (const a of lista) unio.set(gyoker(fid), gyoker(a.id));
    const oszlopok = new Map(), borulasPant = [];
    for (const b of placed) { const r = gyoker(b.id); if (!oszlopok.has(r)) oszlopok.set(r, []); oszlopok.get(r).push(b.id); }
    for (const tagok of oszlopok.values()) {
      const vs = tagok.map((id) => V.get(id)), padlon = vs.filter((v) => v.z0 === 0);
      if (!padlon.length) continue;
      const H = Math.max(...vs.map((v) => v.z1));
      const bx = { x0: Math.min(...padlon.map((v) => v.x0)), x1: Math.max(...padlon.map((v) => v.x1)), y0: Math.min(...padlon.map((v) => v.y0)), y1: Math.max(...padlon.map((v) => v.y1)) };
      const tag = new Set(tagok);
      const tamasztott = (tengely) => {
        const elol = tengely === 'x' ? bx.x0 : bx.y0, hatul = tengely === 'x' ? bx.x1 : bx.y1, max = tengely === 'x' ? t.length : t.width;
        const oldalOk = (pos, also) => {
          if (also ? pos <= 0 : pos >= max) return true; // fal / ajtó
          for (const b of placed) {
            if (tag.has(b.id)) continue;
            const w = V.get(b.id);
            const erint = tengely === 'x' ? (also ? w.x1 === pos : w.x0 === pos) && w.y0 < bx.y1 && w.y1 > bx.y0 : (also ? w.y1 === pos : w.y0 === pos) && w.x0 < bx.x1 && w.x1 > bx.x0;
            if (erint && w.z1 >= H * 0.5) return true;
          }
          return false;
        };
        return (oldalOk(elol, true) ? 1 : 0) + (oldalOk(hatul, false) ? 1 : 0);
      };
      for (const [tengely, el] of [['x', bx.x1 - bx.x0], ['y', bx.y1 - bx.y0]]) {
        if (H / el <= C.borulasArany) continue;
        const db = tamasztott(tengely), nevek = tagok.map((id) => nev(byId.get(id))).join(', ');
        if (db === 0) { add(hibak, 'BORULAS', `${nevek}: ${H} cm magas, önállóan álló oszlop ${el} cm-es alapélen (arány ${(H / el).toFixed(2)} > ${C.borulasArany}), ${tengely === 'x' ? 'menet' : 'kereszt'}irányban egyik oldalon sincs megtámasztva.`, tagok); break; }
        if (db === 1) { borulasPant.push({ tagok, tengely }); add(figy, 'BORULAS_ROGZITES', `${nevek}: ${H} cm magas oszlop ${el} cm-es alapélen (arány ${(H / el).toFixed(2)}), ${tengely === 'x' ? 'menet' : 'kereszt'}irányban csak egy oldalon megtámasztott – borulás elleni pántolás vagy kitámasztás szükséges.`, tagok); break; }
      }
    }

    // --- 5–6. Súlypont, tengelyterhelés, terhelési diagram ------------------------------------------------
    let sulypont = null, tengely = null, tartomany = null, diagramMax = null;
    const m = placed.reduce((s, b) => s + b.weight, 0);
    if (m > 0) {
      let sx = 0, sy = 0, sz = 0;
      for (const b of placed) { const v = V.get(b.id); sx += b.weight * (v.x0 + v.x1) / 2; sy += b.weight * (v.y0 + v.y1) / 2; sz += b.weight * (v.z0 + v.z1) / 2; }
      sulypont = { x: sx / m, y: sy / m, z: sz / m };
      sulypont.oldalElteresCm = sulypont.y - t.width / 2;
      sulypont.oldalElteresPct = (sulypont.oldalElteresCm / t.width) * 100;
      tengely = J.tengelyek(t, placed.map((b) => { const v = V.get(b.id); return { kg: b.weight, x: (v.x0 + v.x1) / 2 }; }), P);
      // Keresztirány: a kerékterhelés-eltérést a teljes jármű (önsúly a középvonalon + rakomány) súlypontja határozza meg.
      // C.keresztAlap = 'rakomany' esetén a rakomány saját súlypontjára vonatkozik a tűrés (szigorúbb).
      const ures = Math.max(0, tengely.ossztomegKg - m);
      sulypont.jarmuElteresCm = (sulypont.oldalElteresCm * m) / (m + ures);
      sulypont.jarmuElteresPct = (sulypont.jarmuElteresCm / t.width) * 100;
      sulypont.keresztPct = C.keresztAlap === 'rakomany' ? sulypont.oldalElteresPct : sulypont.jarmuElteresPct;
      if (Math.abs(sulypont.keresztPct) > C.keresztTuresPct + 1e-9) add(hibak, 'SULYPONT_KERESZT', `A rakomány súlypontja ${hu(Math.abs(sulypont.oldalElteresCm), 1)} cm-rel a ${sulypont.oldalElteresCm < 0 ? 'bal' : 'jobb'} oldal felé esik; ${C.keresztAlap === 'rakomany' ? 'ez' : `a teljes járműé ${hu(Math.abs(sulypont.jarmuElteresCm), 1)} cm, ami`} ${hu(Math.abs(sulypont.keresztPct), 1)}% (megengedett ±${C.keresztTuresPct}%) – egyenetlen kerékterhelés.`, placed.map((b) => b.id));
      if (sulypont.z > (t.height * C.sulypontMagasPct) / 100) add(figy, 'SULYPONT_MAGAS', `A rakomány súlypontja ${hu(sulypont.z)} cm magasan van (a raktérmagasság ${hu((sulypont.z / t.height) * 100)}%-a) – nehéz egységek alulra.`, []);
      for (const a of tengely.tengelyek) if (a.tul) add(hibak, 'TENGELYTERHELES', `${a.nev}: ${hu(a.osszKg)} kg > megengedett ${hu(a.maxKg)} kg (${hu(a.kihasznaltsagPct, 1)}%).`, []);
      if (tengely.kormanyzott && !tengely.kormanyzott.ok) add(hibak, 'KORMANYZOTT_TENGELY', `A kormányzott tengely terhelése ${hu(tengely.kormanyzott.aranyPct, 1)}% (legalább ${tengely.kormanyzott.minPct}% kell).`, []);
      diagramMax = J.diagramErtek(t, sulypont.x, P);
      if (m > diagramMax + 0.5) {
        tartomany = J.megengedettTartomany(t, m, P);
        add(hibak, 'SULYPONT_HOSSZ', `A ${hu(m)} kg rakomány súlypontja ${hu(sulypont.x)} cm-en van a homlokfaltól; itt a terhelési diagram szerint legfeljebb ${hu(diagramMax)} kg megengedett. ${tartomany ? `Ennél a tömegnél a megengedett súlyponttartomány: ${tartomany.min}–${tartomany.max} cm.` : 'Ez a tömeg a jármű egyetlen súlypont-helyzetében sem megengedett.'}`, []);
      } else tartomany = J.megengedettTartomany(t, m, P);
    }

    // --- 7. Hézagok ----------------------------------------------------------------------------------------
    const hezagok = [];
    let oldalOssz = 0, oldalDb = 0;
    for (const b of placed) {
      const v = V.get(b.id);
      let elol = 0, bal = 0, jobb = t.width;
      for (const q of placed) {
        if (q.id === b.id) continue;
        const w = V.get(q.id);
        if (w.x1 <= v.x0 && yz(v, w) && w.x1 > elol) elol = w.x1;
        if (w.y1 <= v.y0 && xz(v, w) && w.y1 > bal) bal = w.y1;
        if (w.y0 >= v.y1 && xz(v, w) && w.y0 < jobb) jobb = w.y0;
      }
      const ge = v.x0 - elol, gb = v.y0 - bal, gj = jobb - v.y1;
      oldalOssz += Math.min(gb, gj); oldalDb++;
      if (ge > C.hezagMenetCm) hezagok.push({ irany: 'menet', id: b.id, cm: ge, x0: elol, x1: v.x0, y0: v.y0, y1: v.y1, z0: v.z0, z1: v.z1 });
      if (gb + gj > C.hezagOldalCm && Math.max(gb, gj) > C.hezagOldalCm) hezagok.push({ irany: 'oldal', id: b.id, cm: gb + gj, bal: gb, jobb: gj, x0: v.x0, x1: v.x1, y0: gb >= gj ? bal : v.y1, y1: gb >= gj ? v.y0 : jobb, z0: v.z0, z1: v.z1 });
    }
    const csoport = (irany) => {
      const g = new Map();
      for (const h of hezagok.filter((q) => q.irany === irany)) { const k = irany === 'menet' ? `${h.x0}|${h.cm}` : `${h.cm}`; if (!g.has(k)) g.set(k, []); g.get(k).push(h); }
      return [...g.values()];
    };
    for (const cs of csoport('menet')) add(figy, 'HEZAG_MENETIRANY', `${cs.length} egység előtt ${cs[0].cm} cm hézag van menetirányban (${cs.slice(0, 4).map((h) => nev(byId.get(h.id))).join(', ')}${cs.length > 4 ? '…' : ''}). Javaslat: kitámasztás / légzsák a hézagba, vagy a rakomány előretolása; ha nem lehet, leszorító pántolás.`, cs.map((h) => h.id));
    for (const cs of csoport('oldal')) add(figy, 'HEZAG_OLDAL', `${cs.length} egység mellett összesen ${cs[0].cm} cm oldalsó hézag van (${cs.slice(0, 4).map((h) => nev(byId.get(h.id))).join(', ')}${cs.length > 4 ? '…' : ''}). Javaslat: légzsák vagy kitöltőanyag, illetve pántolás.`, cs.map((h) => h.id));

    // --- 8. Rögzítési becslés -----------------------------------------------------------------------------
    const rog = rogzites(t, P, C, placed, V, { atlagOldalCm: oldalDb ? oldalOssz / oldalDb : 0 });
    if (borulasPant.length) { rog.borulasPantDb = borulasPant.length; rog.pantDb = Math.max(rog.pantDb, borulasPant.length); while (rog.pantHelyekX.length < rog.pantDb) { const cs = borulasPant[rog.pantHelyekX.length % borulasPant.length]; const v = V.get(cs.tagok[0]); rog.pantHelyekX.push(Math.round((v.x0 + v.x1) / 2)); } rog.elvedoDb = rog.pantDb * 2; }
    if (rog.pantDb > 0) add(figy, 'ROGZITES_ELEGTELEN', `A fal- és súrlódási megtámasztás (μ = ${hu(rog.mu, 2)}) nem elég: becslés szerint legalább ${rog.pantDb} db ${C.stfDaN} daN STF-ű leszorító pánt szükséges${rog.csuszasgatloJavasolt ? ', vagy csúszásgátló alátét (μ = 0,6) a pántszám csökkentésére' : ''}. ${rog.megjegyzes}`, []);

    // --- Lerakodás ---------------------------------------------------------------------------------------
    const ler = L.elemez(t, placed, V, tamaszok, C);
    hibak.push(...ler.hibak); figy.push(...ler.figyelmeztetesek);

    // --- Biztonsági tartalék (%) ---------------------------------------------------------------------------
    const tartalekok = [];
    if (tengely) {
      for (const a of tengely.tengelyek) tartalekok.push({ mi: a.nev, pct: 100 - a.kihasznaltsagPct });
      if (tengely.kormanyzott) tartalekok.push({ mi: 'Kormányzott tengely minimuma', pct: ((tengely.kormanyzott.aranyPct - tengely.kormanyzott.minPct) / tengely.kormanyzott.minPct) * 100 });
    }
    if (sulypont) tartalekok.push({ mi: 'Keresztirányú súlypont', pct: 100 - (Math.abs(sulypont.keresztPct) / C.keresztTuresPct) * 100 });
    if (diagramMax) tartalekok.push({ mi: 'Terhelési diagram', pct: 100 - (m / diagramMax) * 100 });
    const minT = tartalekok.length ? tartalekok.reduce((a, b) => (b.pct < a.pct ? b : a)) : { mi: '–', pct: 100 };

    const kemeny = hibak.length;
    const teljes = boxes.length > 0 && boxes.every((b) => b.placed);
    out.ok = kemeny === 0;
    out.teljes = teljes;
    out.hosszCm = placed.length ? Math.max(...placed.map((b) => V.get(b.id).x1)) : 0;
    out.allapot = kemeny ? E.ALLAPOT.ERVENYTELEN : !teljes ? E.ALLAPOT.RESZLEGES
      : (nemIgazolt.length || figy.some((f) => f.kod === 'NEM_IGAZOLT_TERHELES')) ? E.ALLAPOT.NEM_ELLENORZOTT
        : figy.length ? E.ALLAPOT.FIGYELMEZTETES : E.ALLAPOT.ERVENYES;
    out.mutatok = {
      tomegKg: m, sulypont, tengely, diagramMaxKg: diagramMax, sulypontTartomany: tartomany, rogzites: rog, lerakodas: ler, hezagok,
      tartalekPct: minT.pct, tartalekMi: minT.mi, tartalekok, szint: e.szint, terheles, tamaszok, oszlopok: [...oszlopok.values()],
      atrakas: ler.atrakas, lerakodasiIdoS: ler.osszIdoS,
    };
    return out;
  }

  /** Kézi elhelyezés: a V06 blokkoló hibái + a helyi V07-szabályok blokkolnak; a teljes tervre vonatkozók csak jelzést adnak. */
  function keziEllenoriz(terv, cfg = {}) {
    const r = ellenoriz(terv, cfg, { csakHelyi: true });
    const blokkolo = r.hibak.filter((h) => h.kod !== 'TEHERBIRAS' && (!KODOK[h.kod] || KEZI_BLOKKOLO.has(h.kod)));
    return { ...r, ok: blokkolo.length === 0, blokkolo, reason: blokkolo.length ? blokkolo[0].szoveg : 'Az elhelyezés megfelel a helyi geometriai, halmozási és sérülésmentességi szabályoknak.' };
  }

  /** Lexikografikus kulcs (kisebb = jobb) a tervek összevetéséhez. */
  function kulcs(r, cel = 'A') {
    const m = r.mutatok || {}, kimaradt = r.alap ? r.alap.figyelmeztetesek.filter((f) => f.kod === 'NINCS_ELHELYEZVE').reduce((s, f) => s + f.dobozok.length, 0) : 0;
    const kemeny = r.hibak.length, atr = m.atrakas || 0, tart = m.tartalekPct ?? 0, ido = m.lerakodasiIdoS || 0, hossz = r.hosszCm ?? 0, figyDb = r.figyelmeztetesek.length;
    if (cel === 'B') return [kimaradt, kemeny, atr, hossz, -Math.floor(tart / 5), Math.round(ido / 30), figyDb];
    if (cel === 'C') return [kimaradt, kemeny, atr, -Math.round(tart), hossz, Math.round(ido / 30)];
    return [kimaradt, kemeny, atr, -Math.floor(tart / 10), Math.round(ido / 60), hossz, figyDb];
  }

  return { NYILATKOZAT, ALAP, KODOK, KEZI_BLOKKOLO, TOREKENYSEG, RANG, CSOMAGOLAS, TIPUS_CSOMAGOLAS, egyseg07, nyomasHatar, tamaszArany, beallitas, rang, rogzites, ellenoriz, keziEllenoriz, kulcs };
});
