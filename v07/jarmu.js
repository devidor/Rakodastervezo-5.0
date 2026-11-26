/*
 * Rakománytervező 3D V07 – járműprofilok, tengelyterhelés, terhelési diagram
 * -------------------------------------------------------------------------
 * Koordináták: x a homlokfaltól (cm), a tengelyek és a királycsap helyzete is ehhez képest (negatív = a raktér előtt).
 * Számítás: emelőszabály (két alátámasztású tartó), a rakomány tömegpontjai alapján. A nyerges szerelvénynél
 * a királycsap-terhelés a vontató első és hajtott tengelyére oszlik a nyeregszerkezet helyzete szerint.
 *
 * A SABLONOK értékei TÁJÉKOZTATÓ jellegűek (tipikus gyártói adatokból kerekítve), nem helyettesítik a jármű
 * forgalmi engedélyét és a gyártói terhelési diagramot. A felület ezt jelzi, és minden érték módosítható.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Jarmu = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SABLON_FORRAS = 'Tipikus érték (kerekített gyártói átlag) – a tényleges jármű adataival ellenőrizendő.';
  const nyerges = (ajtoM) => ({
    tipus: 'nyerges',
    kiralycsapX: 140, tengelyX: 915,
    potUresKiralycsapKg: 2800, potUresTengelyKg: 4200, potTengelyMaxKg: 24000,
    vontato: { tengelytavCm: 375, nyeregElotolCm: 60, uresElsoKg: 5000, uresHajtoKg: 2400, elsoMaxKg: 7500, hajtoMaxKg: 11500 },
    kormanyzottMinPct: 20, ossztomegMaxKg: 40000,
    oldalfal: 'L', homlokfal: 'L', ajtoSzelessegCm: 245, ajtoMagassagCm: ajtoM, oldalNyithato: true,
    padlo: 'fa', csuszasgatlo: false, rogzitoKozCm: 100, rogzitoTeherbirasDaN: 2000,
  });
  const szolo = (o) => ({
    tipus: 'szolo', kormanyzottMinPct: 20,
    oldalfal: 'L', homlokfal: 'L', oldalNyithato: false,
    padlo: 'fa', csuszasgatlo: false, rogzitoKozCm: 100, rogzitoTeherbirasDaN: 800, ...o,
  });
  /** Járműsablonok: belső méret, hasznos teher és tengelyprofil. */
  const SABLONOK = Object.freeze({
    'Standard félpótkocsi': { length: 1360, width: 245, height: 270, payloadKg: 24000, profil: nyerges(265) },
    'Mega félpótkocsi': { length: 1360, width: 245, height: 300, payloadKg: 24000, profil: nyerges(295) },
    'Semi-mega félpótkocsi': { length: 1360, width: 245, height: 285, payloadKg: 24000, profil: nyerges(280) },
    'Jumbo – motorkocsi raktér': { length: 770, width: 245, height: 300, payloadKg: 12000,
      profil: szolo({ elsoX: -130, hatsoX: 520, uresElsoKg: 5800, uresHatsoKg: 4200, elsoMaxKg: 9000, hatsoMaxKg: 19000, ossztomegMaxKg: 26000, ajtoSzelessegCm: 245, ajtoMagassagCm: 295, oldalNyithato: true, rogzitoTeherbirasDaN: 2000 }) },
    'Jumbo – pótkocsi raktér': { length: 770, width: 245, height: 300, payloadKg: 12000,
      profil: szolo({ elsoX: 150, hatsoX: 620, uresElsoKg: 2300, uresHatsoKg: 2200, elsoMaxKg: 9000, hatsoMaxKg: 9000, ossztomegMaxKg: 18000, kormanyzottMinPct: null, ajtoSzelessegCm: 245, ajtoMagassagCm: 295, oldalNyithato: true, rogzitoTeherbirasDaN: 2000 }) },
    'Dobozos teherautó': { length: 720, width: 245, height: 250, payloadKg: 7000,
      profil: szolo({ elsoX: -110, hatsoX: 470, uresElsoKg: 3200, uresHatsoKg: 1800, elsoMaxKg: 5500, hatsoMaxKg: 8500, ossztomegMaxKg: 12000, ajtoSzelessegCm: 240, ajtoMagassagCm: 240 }) },
    'Kisteherautó': { length: 420, width: 175, height: 180, payloadKg: 1000,
      profil: szolo({ elsoX: -90, hatsoX: 280, uresElsoKg: 1250, uresHatsoKg: 950, elsoMaxKg: 1800, hatsoMaxKg: 2100, ossztomegMaxKg: 3500, ajtoSzelessegCm: 160, ajtoMagassagCm: 170, rogzitoTeherbirasDaN: 400 }) },
  });

  /** Súrlódási együttható: fa/fa 0,45, csúszásgátló alátéttel 0,6 (EN 12195-1 tájékoztató táblázata alapján). */
  const mu = (p) => (Number.isFinite(p.mu) ? p.mu : p.csuszasgatlo ? 0.6 : 0.45);

  /**
   * A jármű teljes profilja. Ha a tervben nincs profil, a típusnév szerinti sablonból, ennek hiányában
   * a méretek alapján (≥ 12 m: nyerges, különben szóló) képzett általános profil – mindkettő „sablon” forrású.
   */
  function profil(t) {
    const sablon = SABLONOK[t && t.type];
    let alap = sablon ? sablon.profil : (t && t.length >= 1200 ? nyerges(Math.max(100, (t.height || 270) - 5)) : szolo({ elsoX: -110, hatsoX: Math.round((t?.length || 720) * 0.65), uresElsoKg: 3200, uresHatsoKg: 1800, elsoMaxKg: 5500, hatsoMaxKg: 8500, ossztomegMaxKg: 12000 }));
    const sajat = t && t.profil && typeof t.profil === 'object' ? t.profil : null;
    const p = JSON.parse(JSON.stringify({ ...alap, ...(sajat || {}) }));
    if (sajat && sajat.vontato) p.vontato = { ...alap.vontato, ...sajat.vontato };
    if (!Number.isFinite(p.ajtoSzelessegCm)) p.ajtoSzelessegCm = t?.width || 245;
    if (!Number.isFinite(p.ajtoMagassagCm)) p.ajtoMagassagCm = t?.height || 270;
    p.forras = sajat && sajat.forras === 'kezi' ? 'kezi' : 'sablon';
    p.mu = mu(p);
    return p;
  }

  /** Egy tömegpont (x cm-en) két alátámasztás közötti megoszlása: [a A-ra, a B-re] jutó hányad. */
  const megoszlas = (x, xA, xB) => { const b = (x - xA) / (xB - xA); return [1 - b, b]; };

  /** Tengelyenkénti együtthatók: egységnyi rakomány x helyen mennyit terhel az egyes tengelyekre. */
  function egyutthatok(p, x) {
    if (p.tipus === 'nyerges') {
      const [kc, tg] = megoszlas(x, p.kiralycsapX, p.tengelyX), v = p.vontato;
      const elsoArany = v.nyeregElotolCm / v.tengelytavCm;
      return { elso: kc * elsoArany, hajto: kc * (1 - elsoArany), potTengely: tg, kiralycsap: kc };
    }
    const [e, h] = megoszlas(x, p.elsoX, p.hatsoX);
    return { elso: e, hatso: h };
  }
  function uresTerheles(p) {
    if (p.tipus === 'nyerges') {
      const v = p.vontato, kc = p.potUresKiralycsapKg, elsoArany = v.nyeregElotolCm / v.tengelytavCm;
      return { elso: v.uresElsoKg + kc * elsoArany, hajto: v.uresHajtoKg + kc * (1 - elsoArany), potTengely: p.potUresTengelyKg, kiralycsap: kc };
    }
    return { elso: p.uresElsoKg, hatso: p.uresHatsoKg };
  }
  function maximumok(p) {
    if (p.tipus === 'nyerges') return { elso: p.vontato.elsoMaxKg, hajto: p.vontato.hajtoMaxKg, potTengely: p.potTengelyMaxKg };
    return { elso: p.elsoMaxKg, hatso: p.hatsoMaxKg };
  }
  const NEVEK = { elso: 'Kormányzott (első) tengely', hajto: 'Hajtott tengely', potTengely: 'Pótkocsi-tengelycsoport', hatso: 'Hátsó tengely(csoport)', kiralycsap: 'Királycsap (nyeregterhelés)' };
  const kormanyzottE = (p) => p.tipus === 'nyerges' || p.kormanyzottMinPct != null;

  /**
   * Tengelyterhelések. tomegek: [{kg, x}] (x = a tömegpont helye a homlokfaltól, cm).
   * @returns {{tengelyek:[{kulcs,nev,uresKg,rakomanyKg,osszKg,maxKg,kihasznaltsagPct,tul}], kormanyzott:{kg,aranyPct,minPct,ok}|null, ossztomegKg, ossztomegMaxKg, rakomanyKg, sulypontX}}
   */
  function tengelyek(t, tomegek, p = profil(t)) {
    const ures = uresTerheles(p), max = maximumok(p), rak = {};
    let ossz = 0, nyomatek = 0;
    for (const k of Object.keys(ures)) rak[k] = 0;
    for (const m of tomegek) {
      if (!(m.kg > 0)) continue;
      const c = egyutthatok(p, m.x);
      for (const k of Object.keys(c)) rak[k] += m.kg * c[k];
      ossz += m.kg; nyomatek += m.kg * m.x;
    }
    const lista = Object.keys(max).map((k) => {
      const osszKg = ures[k] + rak[k];
      return { kulcs: k, nev: NEVEK[k], uresKg: ures[k], rakomanyKg: rak[k], osszKg, maxKg: max[k], kihasznaltsagPct: (osszKg / max[k]) * 100, tul: osszKg > max[k] + 0.5, emeles: osszKg < 0 };
    });
    let kormanyzott = null;
    if (kormanyzottE(p) && p.kormanyzottMinPct != null) {
      const e = lista.find((a) => a.kulcs === 'elso');
      const alap = p.tipus === 'nyerges' ? e.osszKg + lista.find((a) => a.kulcs === 'hajto').osszKg : lista.reduce((s, a) => s + a.osszKg, 0);
      const aranyPct = alap > 0 ? (e.osszKg / alap) * 100 : 100;
      kormanyzott = { kg: e.osszKg, aranyPct, minPct: p.kormanyzottMinPct, ok: aranyPct + 1e-9 >= p.kormanyzottMinPct };
    }
    const uresOssz = Object.entries(ures).filter(([k]) => k !== 'kiralycsap').reduce((s, [, v]) => s + v, 0);
    return {
      tengelyek: lista, kormanyzott, rakomanyKg: ossz, ossztomegKg: uresOssz + ossz, ossztomegMaxKg: p.ossztomegMaxKg ?? null,
      kiralycsapKg: p.tipus === 'nyerges' ? ures.kiralycsap + rak.kiralycsap : null, sulypontX: ossz > 0 ? nyomatek / ossz : null,
    };
  }

  /** Terhelési diagram: a raktér x helyére koncentrált rakomány legnagyobb megengedett tömege (kg). */
  function diagramErtek(t, x, p = profil(t)) {
    const ures = uresTerheles(p), max = maximumok(p), c = egyutthatok(p, x);
    let P = t.payloadKg;
    for (const k of Object.keys(max)) {
      if (c[k] > 1e-12) P = Math.min(P, (max[k] - ures[k]) / c[k]);
      else if (ures[k] > max[k]) P = 0;
    }
    if (p.kormanyzottMinPct != null && kormanyzottE(p)) {
      const q = p.kormanyzottMinPct / 100;
      const keys = p.tipus === 'nyerges' ? ['elso', 'hajto'] : Object.keys(max);
      const E0 = ures.elso - q * keys.reduce((s, k) => s + ures[k], 0);
      const E1 = c.elso - q * keys.reduce((s, k) => s + c[k], 0);
      // E0 + P·E1 ≥ 0
      if (E1 < -1e-12) P = Math.min(P, E0 / -E1);
      else if (E0 < 0 && E1 <= 1e-12) P = 0;
    }
    return Math.max(0, P);
  }
  /** Diagram mintavételezve (rajzoláshoz). */
  function diagram(t, n = 69, p = profil(t)) {
    const out = [];
    for (let i = 0; i < n; i++) { const x = (t.length * i) / (n - 1); out.push({ x, maxKg: diagramErtek(t, x, p) }); }
    return out;
  }
  /** Az a súlypont-tartomány (cm), ahol az adott rakománytömeg megengedett. null, ha sehol. */
  function megengedettTartomany(t, kg, p = profil(t)) {
    let min = null, max = null;
    for (let x = 0; x <= t.length; x += 1) if (diagramErtek(t, x, p) + 1e-6 >= kg) { if (min === null) min = x; max = x; }
    return min === null ? null : { min, max };
  }

  return { SABLONOK, SABLON_FORRAS, NEVEK, profil, egyutthatok, tengelyek, diagramErtek, diagram, megengedettTartomany };
});
