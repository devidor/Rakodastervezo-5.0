/*
 * Rakománytervező 3D V06 – mentés, betöltés, V05-konverzió és fuvardíjkalkulátor-export
 * ------------------------------------------------------------------------------------
 * Belső tervmodell: { nev, trailer:{type,length,width,height,payloadKg}, elszamolas, beallitasok, boxes:[...] }
 * Minden méret és koordináta egész cm, a homlokfaltól / bal faltól / padlótól mérve.
 *
 * Betölthető: V06 terv (version 6), V03–V05 terv (version 3–5: a fájlban a koordináták a pótkocsi KÖZEPÉHEZ
 * képest cm-ben vannak), V05 / V06 tervgyűjtemény, fuvardíjkalkulátor-export (benne a teljes terv).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./ldm_modul.js'), require('./ellenorzo.js'), require('./mutatok.js'));
  else root.TervIO = factory(root.LDMModul, root.Ellenorzo, root.Mutatok);
})(typeof self !== 'undefined' ? self : this, function (LDM, E, MU) {
  'use strict';
  const PROGRAM = Object.freeze({ nev: 'Rakománytervező 3D V06 – Smart Load Optimizer', verzio: '0.6.0' });
  const MAX_EGYSEG = 300;
  const INTEGRACIO_FORMAT = 'rakodastervezo-fuvardij-export';
  const INTEGRACIO_SEMA = '1.0.0';
  const KOORD = 'x: homlokfaltól, y: bal faltól, z: padlótól; a bal-első-alsó sarok, egész cm';
  const SZIN = /^#[0-9a-f]{6}$/i;
  const PALETTA = ['#8d78fc', '#32bda9', '#f59f54', '#5da9f5', '#ec78ac', '#c7b26a', '#8ade80', '#b28df2'];

  const egesz = (v, min, max, mit) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${mit}: ${min}–${max} közötti egész szám kell (kapott: ${v}).`);
    return n;
  };
  const szam = (v, min, max, mit) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${mit}: ${min}–${max} közötti szám kell (kapott: ${v}).`);
    return Math.round(n * 10) / 10;
  };
  const szoveg = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

  function jarmu(t) {
    if (!t || typeof t !== 'object') throw new Error('Hiányzó járműadatok.');
    return {
      type: szoveg(t.type, 60) || 'Egyedi jármű',
      length: egesz(t.length, 100, 2000, 'Belső hosszúság'),
      width: egesz(t.width, 100, 300, 'Belső szélesség'),
      height: egesz(t.height, 100, 400, 'Belső magasság'),
      payloadKg: szam(t.payloadKg ?? LDM.ALAP_TEHERBIRAS_KG, 1, 60000, 'Hasznos teher'),
    };
  }

  /** Egy egység ellenőrzött beolvasása (koordináták már homlokfaltól mért cm-ben). */
  function egyseg(b, i) {
    const id = egesz(b.id, 1, 1e6, `${i + 1}. egység azonosítója`);
    const m = E.mod(b);
    const maxLoad = b.maxLoadKg === null || b.maxLoadKg === undefined || b.maxLoadKg === '' ? null : szam(b.maxLoadKg, 0, 100000, `#${id} felső terhelhetősége`);
    const stop = b.stop === null || b.stop === undefined || b.stop === '' ? null : egesz(b.stop, 1, 99, `#${id} lerakóhelye`);
    return {
      id, label: szoveg(b.label, 40), name: szoveg(b.name, 60), itemId: szoveg(b.itemId, 30), type: szoveg(b.type, 30) || 'Doboz',
      color: SZIN.test(b.color || '') ? b.color : PALETTA[(id - 1) % PALETTA.length],
      length: egesz(b.length, 1, 2000, `#${id} hosszúsága`), width: egesz(b.width, 1, 2000, `#${id} szélessége`), height: egesz(b.height, 1, 1000, `#${id} magassága`),
      weight: szam(b.weight, 0.1, 50000, `#${id} súlya`),
      stackMode: m, maxLayers: m === 'szint' ? egesz(b.maxLayers ?? 2, 1, 20, `#${id} szintszáma`) : 1, maxLoadKg: maxLoad,
      stackable: m === 'szint', rotatable: b.rotatable !== false, stop,
      rot: b.rot ? 1 : 0, placed: b.placed === true,
      x: b.placed === true ? egesz(b.x, -5000, 5000, `#${id} x`) : 0,
      y: b.placed === true ? egesz(b.y, -5000, 5000, `#${id} y`) : 0,
      z: b.placed === true ? egesz(b.z ?? 0, -5000, 5000, `#${id} z`) : 0,
    };
  }
  function egysegek(lista) {
    if (!Array.isArray(lista)) throw new Error('Hiányzó egységlista.');
    if (lista.length > MAX_EGYSEG) throw new Error(`Legfeljebb ${MAX_EGYSEG} egység tölthető be.`);
    const out = lista.map(egyseg);
    if (new Set(out.map((b) => b.id)).size !== out.length) throw new Error('Ismétlődő egységazonosító.');
    return out;
  }

  /**
   * V03–V05 egyedi tervfájl: a koordináták a pótkocsi közepéhez képest cm-ben (V05 Math.round(m×100)).
   * Visszaalakítás: x = fájl + ⌊L/2⌋, y = fájl + ⌊W/2⌋. Páratlan belméretnél a V05-mentés kerekítése ±1 cm-t
   * okozhat; ha emiatt egy egység kilógna vagy ütközne, a betöltő ±1 cm-es javítást próbál, és ezt jelzi.
   */
  function v05Terv(doc) {
    if (![3, 4, 5].includes(doc.version)) throw new Error('Nem támogatott tervverzió.');
    const tr = doc.version === 5 ? jarmu({ type: doc.trailer?.type || 'Egyedi jármű', ...doc.trailer }) : jarmu({ type: 'Normál', length: 1360, width: 245, height: 270, payloadKg: LDM.ALAP_TEHERBIRAS_KG });
    const v4 = doc.version >= 4;
    const boxes = egysegek((doc.boxes || []).map((b) => ({
      ...b,
      weight: v4 ? b.weight : 100, stackable: v4 ? b.stackable : true, maxLayers: v4 ? b.maxLayers : 3,
      maxLoadKg: v4 ? b.maxLoadKg : 500, z: v4 ? b.z : 0,
    }))).map((b) => (b.placed ? { ...b, x: b.x + Math.floor(tr.length / 2), y: b.y + Math.floor(tr.width / 2) } : b));
    const javitas = [];
    const terv = { nev: 'V05 terv', trailer: tr, elszamolas: doc.version === 5 && doc.billing ? doc.billing : { ...LDM.ALAP_ELSZAMOLAS }, boxes };
    for (let kor = 0; kor < 3; kor++) {
      const e = E.keziEllenoriz(terv);
      const rossz = new Set(e.blokkolo.filter((h) => h.kod === 'HATAR' || h.kod === 'UTKOZES' || h.kod === 'ALATAMASZTAS').flatMap((h) => h.dobozok));
      if (!rossz.size) break;
      for (const id of rossz) {
        const b = terv.boxes.find((q) => q.id === id);
        for (const [k, d] of [['y', -1], ['y', 1], ['x', -1], ['x', 1]]) {
          b[k] += d;
          const e2 = E.keziEllenoriz(terv);
          if (!e2.blokkolo.some((h) => h.dobozok.includes(id))) { javitas.push(`#${id}: ${k} ${d > 0 ? '+' : ''}${d} cm`); break; }
          b[k] -= d;
        }
      }
    }
    terv.megjegyzes = javitas.length ? 'V05-ös kerekítés javítva: ' + javitas.join(', ') : '';
    return terv;
  }

  function v06Terv(doc) {
    return {
      nev: szoveg(doc.nev, 60) || 'Betöltött terv', trailer: jarmu(doc.trailer),
      elszamolas: doc.elszamolas || doc.billing || { ...LDM.ALAP_ELSZAMOLAS },
      beallitasok: doc.beallitasok && typeof doc.beallitasok === 'object' ? doc.beallitasok : {},
      boxes: egysegek(doc.boxes),
    };
  }
  function gyujtemenyTerv(p) {
    return { nev: szoveg(p.nev, 60) || 'Importált terv', savedAt: p.savedAt || null, trailer: jarmu(p.trailer), elszamolas: p.elszamolas || { ...LDM.ALAP_ELSZAMOLAS }, boxes: egysegek(p.boxes) };
  }

  /**
   * Bármely támogatott JSON beolvasása.
   * @returns {{tipus:'terv'|'gyujtemeny', terv?, tervek?, forras:string}}
   */
  function betolt(doc) {
    if (!doc || typeof doc !== 'object') throw new Error('Nem JSON-objektum.');
    if (doc.format === 'rakodastervezo-3d' && doc.version === 6) return { tipus: 'terv', terv: v06Terv(doc), forras: 'V06 terv' };
    if (doc.format === 'rakodastervezo-3d') return { tipus: 'terv', terv: v05Terv(doc), forras: `V0${doc.version} terv` };
    if (doc.format === 'rakodastervezo-3d-tervgyujtemeny' && [5, 6].includes(doc.version) && Array.isArray(doc.plans))
      return { tipus: 'gyujtemeny', tervek: doc.plans.map(gyujtemenyTerv), forras: `V0${doc.version} tervgyűjtemény` };
    if (doc.format === INTEGRACIO_FORMAT) {
      if (!doc.rakomanyterv) throw new Error('Az exportfájl nem tartalmazza a szerkeszthető rakománytervet.');
      return { tipus: 'terv', terv: v06Terv(doc.rakomanyterv), forras: `fuvardíjkalkulátor-export ${doc.schemaVersion}` };
    }
    throw new Error('Ismeretlen fájlformátum.');
  }

  const egysegKi = (b) => ({
    id: b.id, label: b.label || '', name: b.name || '', itemId: b.itemId || '', type: b.type || 'Doboz', color: SZIN.test(b.color || '') ? b.color : PALETTA[(b.id - 1) % PALETTA.length],
    length: b.length, width: b.width, height: b.height, weight: b.weight,
    stackMode: E.mod(b), maxLayers: E.mod(b) === 'szint' ? b.maxLayers : 1, maxLoadKg: b.maxLoadKg ?? null,
    rotatable: b.rotatable !== false, stop: b.stop ?? null,
    rot: b.rot ? 1 : 0, placed: !!b.placed, x: b.placed ? b.x : 0, y: b.placed ? b.y : 0, z: b.placed ? b.z : 0,
  });

  /** V06 tervfájl. */
  function ment(terv, letrehozva = new Date().toISOString()) {
    return {
      format: 'rakodastervezo-3d', version: 6, program: PROGRAM, letrehozva,
      mertekegysegek: { hossz: 'cm', tomeg: 'kg' }, koordinatak: KOORD,
      nev: terv.nev || 'Rakományterv', trailer: { ...terv.trailer }, elszamolas: { ...(terv.elszamolas || LDM.ALAP_ELSZAMOLAS) },
      beallitasok: { ...(terv.beallitasok || {}) },
      boxes: terv.boxes.map(egysegKi),
    };
  }
  function gyujtemenyMent(tervek) {
    return { format: 'rakodastervezo-3d-tervgyujtemeny', version: 6, program: PROGRAM, units: 'cm', coordinates: KOORD, plans: tervek.map((p) => ({ nev: p.nev, savedAt: p.savedAt || null, trailer: p.trailer, elszamolas: p.elszamolas, boxes: p.boxes.map(egysegKi) })) };
  }

  /** Tételek: azonos tételazonosító, vagy (ha nincs) azonos méret, súly és szabályok. */
  function tetelek(boxes) {
    const m = new Map();
    for (const b of boxes) {
      const k = b.itemId ? 'T:' + b.itemId : JSON.stringify([b.length, b.width, b.height, b.weight, E.mod(b), b.maxLayers, b.maxLoadKg ?? null, b.rotatable !== false, b.stop ?? null, b.name || b.type]);
      if (!m.has(k)) m.set(k, { minta: b, ids: [] });
      m.get(k).ids.push(b.id);
    }
    return [...m.values()];
  }

  /**
   * Adatcsomag a fuvardijkalkulator-claude alkalmazás számára (ágfüggetlen, ár nélkül).
   * @param {object} terv     a rakományterv
   * @param {object|null} opt az optimalizálás összefoglalója (mod, seed, iteracio, idoMs, cel, megszakitva)
   */
  function integracioExport(terv, opt = null, letrehozva = new Date().toISOString(), refCm = MU.ALAP_REF_SZELESSEG_CM) {
    const mt = MU.szamol(terv, { refSzelessegCm: refCm, szabadTer: false });
    const e = mt.ellenorzes, boxes = terv.boxes;
    return {
      format: INTEGRACIO_FORMAT, schemaVersion: INTEGRACIO_SEMA, letrehozva,
      forras: { alkalmazas: PROGRAM.nev, verzio: PROGRAM.verzio },
      cel: { alkalmazas: 'fuvardijkalkulator-claude', megjegyzes: 'Ágfüggetlen adatcsomag. Díjat nem tartalmaz; az árat kizárólag a fuvardíjkalkulátor számolhatja.' },
      mertekegysegek: { hossz: 'cm', tomeg: 'kg', ldm: 'm', koordinatak: KOORD },
      jarmu: { tipus: terv.trailer.type, belsoHosszCm: terv.trailer.length, belsoSzelessegCm: terv.trailer.width, belsoMagassagCm: terv.trailer.height, hasznosTeherKg: terv.trailer.payloadKg, megjegyzes: 'A sablonértékek tájékoztató jellegűek.' },
      tetelek: tetelek(boxes).map(({ minta: b, ids }) => ({
        rakomanyAzonosito: b.itemId || b.label || `D${String(b.id).padStart(3, '0')}`,
        megnevezes: b.name || b.type || '',
        darabszam: ids.length, hosszCm: b.length, szelessegCm: b.width, magassagCm: b.height,
        egysegsulyKg: b.weight, ossztomegKg: Math.round(b.weight * ids.length * 10) / 10,
        halmozhatosag: { mod: E.mod(b), leiras: E.MODOK[E.mod(b)], maxSzint: E.mod(b) === 'szint' ? b.maxLayers : 1, maxFelsoTerhelesKg: b.maxLoadKg ?? null },
        elforgathato: b.rotatable !== false, lerakohely: b.stop ?? null, egysegek: ids,
      })),
      mutatok: {
        referenciaSzelessegM: refCm / 100,
        elmeletiLdm: mt.elmeleti ? round6(mt.elmeleti.halmozasNelkul) : null,
        elmeletiLdmHalmozassal: mt.elmeleti ? round6(mt.elmeleti.halmozassalKorrigalt) : null,
        fizikaiHelyigenyM: mt.fizikai ? mt.fizikai.helyigenyM : null,
        dijszamitasiLdm: mt.dijszamitas ? mt.dijszamitas.elszamolasiLdm : null,
        padloKihasznaltsagPct: mt.fizikai ? round6(mt.fizikai.padloKihasznaltsagPct) : null,
        terfogatKihasznaltsagPct: round6(mt.terfogatKihasznaltsagPct),
        ossztomegKg: mt.osszTomegKg, elhelyezettTomegKg: mt.elhelyezettTomegKg,
        megjegyzes: 'A fizikai helyigény és az elméleti LDM nem azonos díjszámítási alap.',
      },
      elhelyezett: { darab: mt.elhelyezett, egysegek: boxes.filter((b) => b.placed).map((b) => ({ id: b.id, x: b.x, y: b.y, z: b.z, forgatva90: b.rot === 1 })) },
      elNemHelyezett: { darab: mt.kimaradt, egysegek: boxes.filter((b) => !b.placed).map((b) => ({ id: b.id, ok: opt?.kimaradt?.find((k) => k.id === b.id)?.kod || 'NINCS_ELHELYEZVE' })) },
      optimalizalas: opt ? { mod: opt.mod, terv: opt.cel, seed: opt.seed, iteracio: opt.iteracio, idoMs: Math.round(opt.idoMs), megszakitva: !!opt.megszakitva, heurisztikus: true } : null,
      ervenyesseg: { allapot: e.allapot, ervenyes: e.ok && e.teljes, hibak: e.hibak.map((h) => ({ kod: h.kod, szoveg: h.szoveg })), figyelmeztetesek: e.figyelmeztetesek.map((h) => ({ kod: h.kod, szoveg: h.szoveg })) },
      arazas: null,
      rakomanyterv: ment(terv, letrehozva),
    };
  }
  const round6 = (x) => Math.round(x * 1e6) / 1e6;

  /** Az exportfájl szerkezeti ellenőrzése (sémateszthez és importhoz). Hibák listáját adja vissza. */
  function integracioEllenoriz(d) {
    const h = [];
    const kell = (cond, s) => { if (!cond) h.push(s); };
    kell(d && d.format === INTEGRACIO_FORMAT, 'format');
    kell(typeof d?.schemaVersion === 'string' && /^\d+\.\d+\.\d+$/.test(d.schemaVersion), 'schemaVersion');
    kell(d?.jarmu && ['tipus', 'belsoHosszCm', 'belsoSzelessegCm', 'belsoMagassagCm', 'hasznosTeherKg'].every((k) => k in d.jarmu), 'jarmu');
    kell(Array.isArray(d?.tetelek) && d.tetelek.every((t) => ['rakomanyAzonosito', 'darabszam', 'hosszCm', 'szelessegCm', 'magassagCm', 'egysegsulyKg', 'ossztomegKg', 'halmozhatosag'].every((k) => k in t)), 'tetelek');
    kell(d?.mutatok && ['elmeletiLdm', 'fizikaiHelyigenyM', 'padloKihasznaltsagPct', 'terfogatKihasznaltsagPct'].every((k) => k in d.mutatok), 'mutatok');
    kell(d?.elhelyezett && Number.isInteger(d.elhelyezett.darab) && d?.elNemHelyezett && Number.isInteger(d.elNemHelyezett.darab), 'elhelyezett/elNemHelyezett');
    kell('optimalizalas' in (d || {}), 'optimalizalas');
    kell(d?.ervenyesseg && typeof d.ervenyesseg.allapot === 'string' && typeof d.ervenyesseg.ervenyes === 'boolean', 'ervenyesseg');
    kell(d?.arazas === null, 'arazas (null kell)');
    return h;
  }

  return { PROGRAM, MAX_EGYSEG, INTEGRACIO_FORMAT, INTEGRACIO_SEMA, jarmu, egysegek, betolt, ment, gyujtemenyMent, tetelek, integracioExport, integracioEllenoriz };
});
