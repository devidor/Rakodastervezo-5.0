/*
 * Rakománytervező 3D V07 – profi optimalizáló (sérülésmentesség → átrakás nélküli lerakodás → tartalék → idő → hossz)
 * -------------------------------------------------------------------------------------------------------------------
 * A V06 Extreme Point + Best Fit + FFD + seedelt véletlen keresésére épül, a következőkkel:
 *   - Lerakó-tudatos konstrukció: a később lerakott egységek kerülnek előre (homlokfal felé), lerakón belül
 *     nem törékeny és nehéz előbb (alulra), törékeny később (felülre).
 *   - Minden jelöltnél kemény feltétel: ütközés, alátámasztás (több egységen átívelve is, arány + túllógás nélkül),
 *     halmozási mód és szint, felső terhelhetőség, felületi nyomás, törékenység, nehéz a könnyűn, ajtóméret,
 *     tető alatti rés, villairány, valamint az átrakás nélküli lerakodás (kivételi folyosók, rajta álló egység).
 *   - Utófeldolgozás: keresztirányú súlypont kiegyenlítése (oszlopok oldalirányú tolása), és ha a tengelyterhelés
 *     megkívánja, a teljes rakomány hátrébb tolása.
 *   - Döntés lexikografikus kulccsal (Biztonsag.kulcs): kimaradt → kemény hiba → átrakás → tartalék → idő → hossz.
 *     Kemény szabályt sértő terv soha nem kap „Érvényes” állapotot.
 * Az eredmény heurisztikus: a talált legjobb terv, nem igazolt optimum.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./geometria.js'), require('./ellenorzo.js'), require('./biztonsag.js'), require('./lerakodas.js'), require('./jarmu.js'), require('./optimalizalo.js'));
  else root.OptimalizaloProfi = factory(root.Geometria, root.Ellenorzo, root.Biztonsag, root.Lerakodas, root.Jarmu, root.Optimalizalo);
})(typeof self !== 'undefined' ? self : this, function (G, E, B, L, J, O) {
  'use strict';

  const MODOK = O.MODOK;
  const MEGJEGYZES = 'Heurisztikus keresés: a talált legjobb terv a lexikografikus cél szerint (biztonság → átrakás → tartalék → lerakodási idő → hossz), nem igazolt optimum.';
  const most = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  const hasonlit = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = a[i] ?? 0, y = b[i] ?? 0; if (x !== y) return x < y ? -1 : 1; } return 0; };
  const atfed = G.atfed;
  const nev = (u) => (u.label ? `${u.label} (#${u.id})` : `${u.id}. doboz`);
  const hu = (n) => Number(n).toLocaleString('hu-HU', { maximumFractionDigits: 1 });
  const atfedTer = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

  /** Megengedett alakzatok (orientációk) a jármű, az ajtó, a tető és a kezelés feltételeivel. */
  function formak(u, t, P, C, old) {
    const lista = [];
    if (u.billentheto && !u.allo) {
      const D = { L: u.length, W: u.width, H: u.height }, seen = new Set();
      for (const [a, b, c] of [['L', 'W', 'H'], ['W', 'L', 'H'], ['L', 'H', 'W'], ['H', 'L', 'W'], ['W', 'H', 'L'], ['H', 'W', 'L']]) {
        const k = `${D[a]}x${D[b]}x${D[c]}`; if (seen.has(k)) continue; seen.add(k);
        lista.push({ l: D[a], w: D[b], h: D[c], rot: 0, dims: { length: D[a], width: D[b], height: D[c] }, billentve: c === 'H' ? null : c });
      }
    } else {
      lista.push({ l: u.length, w: u.width, h: u.height, rot: 0, dims: null, billentve: null });
      if (u.rotatable !== false && u.length !== u.width) lista.push({ l: u.width, w: u.length, h: u.height, rot: 1, dims: null, billentve: null });
    }
    let ok = lista.filter((f) => f.l <= t.length && f.w <= t.width && f.h <= t.height);
    if (!ok.length) return { formak: [], ok: 'NEM_FER_BE' };
    ok = ok.filter((f) => f.h <= t.height - C.tetoResCm);
    if (!ok.length) return { formak: [], ok: 'TETO_RES' };
    if (old === 'hatso') ok = ok.filter((f) => f.w <= P.ajtoSzelessegCm && f.h <= P.ajtoMagassagCm);
    else if ((old === 'bal' || old === 'jobb') && !P.oldalNyithato) ok = [];
    if (!ok.length) return { formak: [], ok: 'AJTO_MERET' };
    const v = ok.filter((f) => f.billentve || L.villaOk({ ...u, rot: f.rot }, old));
    if (!v.length) return { formak: [], ok: 'KEZELES_IRANY' };
    return { formak: v, ok: null };
  }

  /**
   * Egy greedy elhelyezési menet adott sorrendben, a V07 kemény szabályaival.
   * @returns {{helyek:Map, kimaradt:{id,kod}[], maxX:number, tomeg:number}}
   */
  function elhelyez(t, P, C, sorrend, S, opt = {}) {
    const idx = new G.TerIndex(50), rec = new Map(), helyek = new Map(), kimaradt = [];
    let pontok = [{ x: 0, y: 0, z: 0 }], maxX = 0, tomeg = 0;
    const bent = (px, py, pz) => {
      for (const e of idx.jeloltek({ x0: px, x1: px + 1, y0: py, y1: py + 1 }))
        if (e.v.x0 <= px && px < e.v.x1 && e.v.y0 <= py && py < e.v.y1 && e.v.z0 <= pz && pz < e.v.z1) return true;
      return false;
    };
    const vetitY = (px, py, pz) => {
      let y = 0;
      for (const e of idx.jeloltek({ x0: px, x1: px + 1, y0: 0, y1: Math.max(1, py) }))
        if (e.v.x0 <= px && px < e.v.x1 && e.v.z0 <= pz && pz < e.v.z1 && e.v.y1 <= py && e.v.y1 > y) y = e.v.y1;
      return y;
    };
    const vetitX = (px, py, pz) => {
      let x = 0;
      for (const e of idx.jeloltek({ x0: 0, x1: Math.max(1, px), y0: py, y1: py + 1 }))
        if (e.v.y0 <= py && py < e.v.y1 && e.v.z0 <= pz && pz < e.v.z1 && e.v.x1 <= px && e.v.x1 > x) x = e.v.x1;
      return x;
    };
    const tur = 1 + C.nehezKonnyuTuresPct / 100;
    /** Borulás: magas oszlopnál az adott tengely mentén legalább az egyik oldalon fal vagy elég magas szomszéd kell. */
    const oldalTamasz = (bx, tengely, irany, H) => {
      if (tengely === 'x' ? (irany < 0 ? bx.x0 <= 0 : bx.x1 >= t.length) : (irany < 0 ? bx.y0 <= 0 : bx.y1 >= t.width)) return true;
      const sav = tengely === 'x'
        ? { x0: irany < 0 ? bx.x0 - 1 : bx.x1, x1: irany < 0 ? bx.x0 : bx.x1 + 1, y0: bx.y0, y1: bx.y1 }
        : { x0: bx.x0, x1: bx.x1, y0: irany < 0 ? bx.y0 - 1 : bx.y1, y1: irany < 0 ? bx.y0 : bx.y1 + 1 };
      for (const e of idx.jeloltek(sav)) {
        const w = e.v;
        const erint = tengely === 'x' ? (irany < 0 ? w.x1 === bx.x0 : w.x0 === bx.x1) && w.y0 < bx.y1 && w.y1 > bx.y0 : (irany < 0 ? w.y1 === bx.y0 : w.y0 === bx.y1) && w.x0 < bx.x1 && w.x1 > bx.x0;
        if (erint && w.z1 >= H * 0.5) return true;
      }
      return false;
    };
    const borulasOk = (bx, H) => {
      for (const [tg, el] of [['x', bx.x1 - bx.x0], ['y', bx.y1 - bx.y0]]) {
        if (H / el <= C.borulasArany) continue;
        if (!oldalTamasz(bx, tg, -1, H) && !oldalTamasz(bx, tg, 1, H)) return false;
      }
      return true;
    };
    const padloBx = (lista) => {
      let bx = null; const seen = new Set();
      const jar = (r) => { if (seen.has(r)) return; seen.add(r); if (!r.alsok.length) { const w = r.v; bx = bx ? { x0: Math.min(bx.x0, w.x0), x1: Math.max(bx.x1, w.x1), y0: Math.min(bx.y0, w.y0), y1: Math.max(bx.y1, w.y1) } : { x0: w.x0, x1: w.x1, y0: w.y0, y1: w.y1 }; } for (const a of r.alsok) jar(a.r); };
      for (const a of lista) jar(a.r);
      return bx;
    };
    /** Alátámasztás és teherlánc vizsgálata; sikernél a támaszlista, különben null. */
    function tamasz(u, v) {
      const lista = [];
      for (const e of idx.jeloltek(v)) if (e.v.z1 === v.z0) { const ter = atfedTer(v, e.v); if (ter > 0) lista.push({ r: e.adat, ter }); }
      if (!lista.length) return null;
      const alap = (v.x1 - v.x0) * (v.y1 - v.y0), ossz = lista.reduce((s, a) => s + a.ter, 0);
      if (ossz + 1e-9 < B.tamaszArany(u, C) * alap) return null;
      let bx = null;
      for (const a of lista) { const w = a.r.v; bx = bx ? { x0: Math.min(bx.x0, w.x0), x1: Math.max(bx.x1, w.x1), y0: Math.min(bx.y0, w.y0), y1: Math.max(bx.y1, w.y1) } : { ...w }; }
      if (v.x0 < bx.x0 || v.x1 > bx.x1 || v.y0 < bx.y0 || v.y1 > bx.y1) return null;
      if (!E.felulreTeheto(u) || !u.tomegIgazolt) return null;
      let sumW = 0, szint = 0;
      for (const a of lista) {
        const s = a.r.u;
        a.share = a.ter / ossz;
        if (!E.raTeheto(s) || s.maxLoadKg === null || !s.tomegIgazolt) return null;
        const rs = B.rang(s);
        if (rs === 3 || (rs >= 1 && (B.rang(u) < rs || u.weight > s.weight))) return null;
        if (S.van && S.eff(u) > S.eff(s)) return null; // később lerakott nem kerülhet korábbin
        sumW += s.weight; szint = Math.max(szint, a.r.szint);
      }
      if (u.weight > sumW * tur + 1e-9) return null;
      const ujSzint = szint + 1;
      if (ujSzint > E.szintKorlat(u)) return null;
      // Teher szétosztása (gyémánt alakú gráfnál összegezve), majd minden érintett egység és érintkezés ellenőrzése.
      const plusz = new Map();
      const terjed = (r, kg) => { plusz.set(r, (plusz.get(r) || 0) + kg); for (const a of r.alsok) terjed(a.r, kg * a.share); };
      for (const a of lista) {
        terjed(a.r, u.weight * a.share);
        const h = B.nyomasHatar(a.r.u);
        if (h != null && (u.weight * a.share) / (a.ter / 1e4) > h * 1.0001) return null;
      }
      for (const [r, kg] of plusz) {
        if (r.u.maxLoadKg === null || r.teher + kg > r.u.maxLoadKg + 1e-6) return null;
        if (ujSzint > E.szintKorlat(r.u)) return null;
        for (const a of r.alsok) {
          const h = B.nyomasHatar(a.r.u);
          if (h != null && ((r.u.weight + r.teher + kg) * a.share) / (a.ter / 1e4) > h * 1.0001) return null;
        }
      }
      return { lista, szint: ujSzint };
    }
    const reszek = [...rec.values()];
    for (const u of sorrend) {
      const old = L.oldal(u, C), su = S.eff(u);
      const F = formak(u, t, P, C, old);
      if (!F.formak.length) { kimaradt.push({ id: u.id, kod: F.ok }); continue; }
      if (tomeg + u.weight > t.payloadKg) { kimaradt.push({ id: u.id, kod: 'HASZNOS_TEHER_TULLEPES' }); continue; }
      const minL = Math.min(...F.formak.map((f) => f.l));
      const emel = L.emelesCm(u, C);
      let best = null;
      for (const p of pontok) {
        if (best && Math.max(maxX, p.x + minL) > best.s[0]) continue;
        for (const f of F.formak) for (const py of p.z === 0 && p.y !== t.width - f.w && t.width - f.w >= 0 ? [p.y, t.width - f.w] : [p.y]) {
          const v = { x0: p.x, x1: p.x + f.l, y0: py, y1: py + f.w, z0: p.z, z1: p.z + f.h };
          if (v.x1 > t.length || v.y1 > t.width || v.z1 > t.height - C.tetoResCm) continue;
          const s = [Math.max(maxX, v.x1), v.x0, v.z0, old === 'jobb' ? t.width - v.y1 : v.y0];
          if (best && hasonlit(s, best.s) >= 0) continue;
          if (idx.utkozik(v)) continue;
          let tam = null;
          if (v.z0 > 0) { if (opt.halmozas === false) continue; tam = tamasz(u, v); if (!tam) continue; if (!borulasOk(padloBx(tam.lista), v.z1)) continue; }
          else if (!borulasOk(v, v.z1)) continue;
          if (S.van) {
            const fu = L.folyoso(v, old, t, C.oldalRahagyasCm, emel);
            let jo = true;
            for (const r of reszek) {
              if (r.stop < su && atfed(r.folyoso, v)) { jo = false; break; }
              if (r.stop > su && atfed(fu, r.v)) { jo = false; break; }
            }
            if (!jo) continue;
          }
          best = { s, v, f, tam };
        }
      }
      if (!best) { kimaradt.push({ id: u.id, kod: 'NINCS_SZABAD_HELY' }); continue; }
      const { v, f, tam } = best;
      const ra = { u, v, szint: tam ? tam.szint : 1, alsok: tam ? tam.lista : [], teher: 0, stop: su, folyoso: L.folyoso(v, old, t, C.oldalRahagyasCm, emel) };
      if (tam) { const terjed = (r, kg) => { r.teher += kg; for (const a of r.alsok) terjed(a.r, kg * a.share); }; for (const a of tam.lista) terjed(a.r, u.weight * a.share); }
      idx.hozzaad(u.id, v, ra); rec.set(u.id, ra); reszek.push(ra);
      helyek.set(u.id, { x: v.x0, y: v.y0, z: v.z0, rot: f.rot, dims: f.dims, billentve: f.billentve });
      maxX = Math.max(maxX, v.x1); tomeg += u.weight;
      const uj = [[v.x1, v.y0, v.z0], [v.x0, v.y1, v.z0], [v.x1, vetitY(v.x1, v.y0, v.z0), v.z0], [vetitX(v.x0, v.y1, v.z0), v.y1, v.z0]];
      if (E.raTeheto(u)) uj.push([v.x0, v.y0, v.z1]);
      pontok = pontok.filter((q) => !(v.x0 <= q.x && q.x < v.x1 && v.y0 <= q.y && q.y < v.y1 && v.z0 <= q.z && q.z < v.z1));
      for (const [x, y, z] of uj) {
        if (x >= t.length || y >= t.width || z >= t.height) continue;
        if (pontok.some((q) => q.x === x && q.y === y && q.z === z) || bent(x, y, z)) continue;
        pontok.push({ x, y, z });
      }
    }
    return { helyek, kimaradt, maxX, tomeg };
  }

  // --- Utófeldolgozás ---------------------------------------------------------------------------------------
  const box3 = (b) => ({ x0: b.x, x1: b.x + (b.rot ? b.width : b.length), y0: b.y, y1: b.y + (b.rot ? b.length : b.width), z0: b.z, z1: b.z + b.height });

  /** Keresztirányú súlypont kiegyenlítése összefüggő oszlopcsoportok oldalirányú tolásával (új tömb, az eredeti nem változik). */
  function oldalKiegyenlit(t, boxes, C) {
    const out = boxes.map((b) => ({ ...b })), pl = out.filter((b) => b.placed);
    const m = pl.reduce((s, b) => s + b.weight, 0);
    if (!m) return out;
    const V = new Map(pl.map((b) => [b.id, box3(b)]));
    const yc = () => pl.reduce((s, b) => { const v = V.get(b.id); return s + b.weight * (v.y0 + v.y1) / 2; }, 0) / m;
    const tol = (C.keresztTuresPct / 100) * t.width;
    if (Math.abs(yc() - t.width / 2) <= tol * 0.6) return out;
    const unio = new Map(pl.map((b) => [b.id, b.id]));
    const gy = (a) => { while (unio.get(a) !== a) a = unio.get(a); return a; };
    for (const a of pl) for (const b of pl) { const va = V.get(a.id), vb = V.get(b.id); if (a.id !== b.id && va.z0 === vb.z1 && atfedTer(va, vb) > 0) unio.set(gy(a.id), gy(b.id)); }
    const komp = new Map();
    for (const b of pl) { const r = gy(b.id); if (!komp.has(r)) komp.set(r, []); komp.get(r).push(b); }
    // Magas (borulásra hajlamos) oszlopcsoport nem mozdul, mert elveszítené az oldaltámaszát.
    const magas = (cs) => { const pad = cs.map((b) => V.get(b.id)).filter((v) => v.z0 === 0); if (!pad.length) return true; const H = Math.max(...cs.map((b) => V.get(b.id).z1)); const w = Math.max(...pad.map((v) => v.y1)) - Math.min(...pad.map((v) => v.y0)); return H / w > C.borulasArany; };
    const lista = [...komp.values()].filter((cs) => !magas(cs)).sort((a, b) => b.reduce((s, q) => s + q.weight, 0) - a.reduce((s, q) => s + q.weight, 0));
    for (let kor = 0; kor < 3; kor++) {
      for (const cs of lista) {
        const dev = yc() - t.width / 2;
        if (Math.abs(dev) <= tol * 0.5) return out;
        const mc = cs.reduce((s, q) => s + q.weight, 0), irany = dev > 0 ? -1 : 1;
        let kell = Math.round(Math.abs(dev) * m / mc), hely = Infinity;
        const tag = new Set(cs.map((b) => b.id));
        for (const b of cs) {
          const v = V.get(b.id);
          hely = Math.min(hely, irany > 0 ? t.width - v.y1 : v.y0);
          for (const o of pl) {
            if (tag.has(o.id)) continue;
            const w = V.get(o.id);
            if (!(w.x0 < v.x1 && w.x1 > v.x0 && w.z0 < v.z1 && w.z1 > v.z0)) continue;
            if (irany > 0 && w.y0 >= v.y1) hely = Math.min(hely, w.y0 - v.y1);
            if (irany < 0 && w.y1 <= v.y0) hely = Math.min(hely, v.y0 - w.y1);
          }
        }
        const d = Math.max(0, Math.min(kell, hely)) * irany;
        if (!d) continue;
        for (const b of cs) { b.y += d; V.set(b.id, box3(b)); }
      }
    }
    return out;
  }

  /** Ha a tengelyterhelés vagy a terhelési diagram megsérül, a teljes rakomány hátrébb tolása (ha van hely). */
  function hosszIgazit(t, boxes, P) {
    const pl = boxes.filter((b) => b.placed);
    if (!pl.length) return boxes;
    const maxX = Math.max(...pl.map((b) => box3(b).x1)), szabad = t.length - maxX;
    if (szabad <= 0) return boxes;
    const ertek = (d) => {
      const tg = J.tengelyek(t, pl.map((b) => { const v = box3(b); return { kg: b.weight, x: (v.x0 + v.x1) / 2 + d }; }), P);
      const tul = tg.tengelyek.filter((a) => a.tul).length + (tg.kormanyzott && !tg.kormanyzott.ok ? 1 : 0);
      // Cél: nincs túlterhelés, és legalább 10% tartalék a legjobban terhelt tengelyen – a lehető legkisebb tolással.
      return [tul, Math.max(0, Math.round(Math.max(...tg.tengelyek.map((a) => a.kihasznaltsagPct)) - 90))];
    };
    const e0 = ertek(0);
    if (e0[0] === 0 && e0[1] === 0) return boxes;
    let best = { d: 0, e: e0 };
    for (let d = 5; d <= szabad; d += 5) { const e = ertek(d); if (hasonlit(e, best.e) < 0) best = { d, e }; if (e[0] === 0 && e[1] === 0) break; }
    if (!best.d) return boxes;
    return boxes.map((b) => (b.placed ? { ...b, x: b.x + best.d } : { ...b }));
  }

  // --- Keresés -----------------------------------------------------------------------------------------------
  const KULCSOK = [
    ['alapterület', (u) => u.length * u.width],
    ['súly (nehéz alulra)', (u) => u.weight],
    ['térfogat', (u) => u.length * u.width * u.height],
    ['magasság', (u) => u.height],
    ['leghosszabb él', (u) => Math.max(u.length, u.width)],
    ['padlóra kötött előre', (u) => (E.mod(u) === 'nem' ? 1e12 : 0) + u.length * u.width],
  ];

  function keresesInditas(terv, beall = {}) {
    const modKulcs = MODOK[beall.mod] ? beall.mod : 'gyors', M = MODOK[modKulcs];
    const idokorlat = beall.idokorlatMs ?? M.idoMs, veletlenMax = beall.veletlenIter ?? M.veletlenIter;
    const seed = (beall.seed ?? 20261126) >>> 0, rnd = O.mulberry32(seed);
    const C = B.beallitas(beall.cfg || {}), t = terv.trailer, P = J.profil(t);
    const units = terv.boxes.map((b) => {
      const u = B.egyseg07({ ...E.normalizal(b), ...b });
      const e = u.eredeti && u.billentve ? u.eredeti : null; // korábban billentett egység: eredeti méretekkel indul
      return { ...E.normalizal(u), ...u, ...(e ? { length: e.length, width: e.width, height: e.height } : {}), billentve: null, eredeti: undefined, placed: false, x: 0, y: 0, z: 0, rot: 0 };
    });
    const byId = new Map(units.map((u) => [u.id, u]));
    const S = L.stopok(units);
    const lb = O.alsoKorlat(t, units);
    const start = most();
    let iter = 0, veletlen = 0, kesz = units.length === 0, megszakitva = false, idoLejart = false;
    const dontok = { A: [], B: [], C: [] }, DONTO = 4;

    const rendez = (kulcs, zaj = null, torek = true) => {
      const k = new Map(units.map((u) => [u.id, kulcs(u) * (zaj ? 1 + zaj() : 1)]));
      return units.slice().sort((a, b) => (S.eff(b) - S.eff(a)) || (torek ? B.rang(a) - B.rang(b) : 0) || k.get(b.id) - k.get(a.id) || a.id - b.id);
    };
    const sor = [];
    for (const [n, k] of KULCSOK) sor.push({ nev: 'lerakó + törékenység + ' + n, sorrend: rendez(k) });
    for (const [n, k] of KULCSOK.slice(0, 3)) sor.push({ nev: 'lerakó + ' + n, sorrend: rendez(k, null, false) });
    for (const [n, k] of KULCSOK.slice(0, 2)) sor.push({ nev: 'halmozás nélkül + ' + n, sorrend: rendez(k), opt: { halmozas: false } });

    function gyors(r) {
      const kimaradt = r.kimaradt.length;
      const tomegek = [];
      let sy = 0, m = 0, ido = 0;
      for (const [id, h] of r.helyek) {
        const u = byId.get(id), d = h.dims || { length: u.length, width: u.width, height: u.height };
        const l = h.rot ? d.width : d.length, w = h.rot ? d.length : d.width;
        tomegek.push({ kg: u.weight, x: h.x + l / 2 }); sy += u.weight * (h.y + w / 2); m += u.weight;
        ido += (C.idok[L.kezeles(u)] ?? 60) + ((t.length - h.x - l) / 100) * C.melysegSpM + (h.z > 0 ? C.szintPotlekS : 0);
      }
      let kem = 0, tart = 100;
      if (m > 0) {
        const tg = J.tengelyek(t, tomegek, P);
        for (const a of tg.tengelyek) { if (a.tul) kem++; tart = Math.min(tart, 100 - a.kihasznaltsagPct); }
        if (tg.kormanyzott && !tg.kormanyzott.ok) kem++;
        const ures = Math.max(0, tg.ossztomegKg - m);
        const dev = Math.abs(sy / m - t.width / 2) / t.width * 100 * (C.keresztAlap === 'rakomany' ? 1 : m / (m + ures));
        if (dev > C.keresztTuresPct) kem += 0.5; // utófeldolgozással gyakran javítható
        tart = Math.min(tart, 100 - (dev / C.keresztTuresPct) * 100);
      }
      return { kimaradt, kem, tart, ido, hossz: r.maxX };
    }
    const kulcsGy = (g, cel) => (cel === 'B' ? [g.kimaradt, g.kem, g.hossz, -Math.floor(g.tart / 5)] : cel === 'C' ? [g.kimaradt, g.kem, -Math.round(g.tart), g.hossz] : [g.kimaradt, g.kem, -Math.floor(g.tart / 10), Math.round(g.ido / 60), g.hossz]);
    function ertekel(sorrend, nevS, opt) {
      const r = elhelyez(t, P, C, sorrend, S, opt), g = gyors(r);
      const sig = [...r.helyek].map(([id, h]) => `${id}:${h.x},${h.y},${h.z},${h.rot}`).join('|');
      for (const cel of ['A', 'B', 'C']) {
        const k = kulcsGy(g, cel), d = dontok[cel];
        if (d.some((q) => q.sig === sig)) continue;
        if (d.length < DONTO || hasonlit(k, d[d.length - 1].k) < 0) {
          d.push({ k, r, sorrend, nev: nevS, sig, idoMs: most() - start, iter });
          d.sort((a, b) => hasonlit(a.k, b.k)); if (d.length > DONTO) d.pop();
        }
      }
    }
    function kovetkezo() {
      if (sor.length) { const s = sor.shift(); ertekel(s.sorrend, s.nev, s.opt); return; }
      veletlen++;
      const alap = dontok[['A', 'B', 'C'][veletlen % 3]][0]?.sorrend || units;
      let sorrend;
      if (rnd() < 0.5) {
        sorrend = alap.slice();
        const csere = 1 + Math.floor(rnd() * 3);
        for (let i = 0; i < csere; i++) {
          const a = Math.floor(rnd() * sorrend.length), b = Math.floor(rnd() * sorrend.length);
          if (S.eff(sorrend[a]) !== S.eff(sorrend[b])) continue; // csak lerakón belül
          [sorrend[a], sorrend[b]] = [sorrend[b], sorrend[a]];
        }
      } else {
        const k = KULCSOK[Math.floor(rnd() * KULCSOK.length)][1];
        sorrend = rendez(k, () => 0.4 * (rnd() - 0.5), rnd() < 0.8);
      }
      const halm = rnd() < 0.15 ? { halmozas: false } : undefined;
      ertekel(sorrend, 'véletlen #' + veletlen + (halm ? ' (halmozás nélkül)' : ''), halm);
    }
    function vegeE() {
      if (most() - start >= idokorlat) { idoLejart = true; return true; }
      if (sor.length) return false;
      if (veletlen >= veletlenMax) return true;
      const a = dontok.A[0];
      if (a && a.k[0] === 0 && a.k[1] === 0 && a.r.maxX <= lb && !S.van) return true;
      return false;
    }
    function lepes(budgetMs = 50) {
      const vege = most() + budgetMs;
      while (!kesz && most() < vege) { kovetkezo(); iter++; if (vegeE()) kesz = true; }
      return allapot();
    }
    function allapot() {
      const a = dontok.A[0];
      return { kesz, iter, idoMs: most() - start, idokorlatMs: idokorlat, legjobbHosszCm: a ? a.r.maxX : null, elhelyezett: a ? a.r.helyek.size : 0, osszes: units.length, alsoKorlatCm: lb };
    }
    function megszakit() { megszakitva = !kesz; kesz = true; }

    function dobozok(r) {
      return units.map((u) => {
        const p = r.helyek.get(u.id);
        if (!p) return { ...u, placed: false, x: 0, y: 0, z: 0, rot: 0 };
        const b = { ...u, placed: true, x: p.x, y: p.y, z: p.z, rot: p.rot };
        if (p.dims) { Object.assign(b, p.dims); if (p.billentve) { b.billentve = p.billentve; b.eredeti = { length: u.length, width: u.width, height: u.height }; } }
        return b;
      });
    }
    const cfgKi = beall.cfg || {}, ellCache = new Map();
    function tervOsszeallit(cel) {
      let legjobb = null;
      for (const d of dontok[cel]) {
        const alap = dobozok(d.r);
        const valtozatok = [alap];
        const ok1 = oldalKiegyenlit(t, alap, C); valtozatok.push(ok1);
        valtozatok.push(hosszIgazit(t, ok1, P));
        for (const boxes of valtozatok) {
          const sg = boxes.map((q) => q.placed ? `${q.x},${q.y},${q.z},${q.rot},${q.length},${q.width},${q.height}` : '-').join('|');
          let r = ellCache.get(sg);
          if (!r) { r = B.ellenoriz({ trailer: t, boxes }, cfgKi); ellCache.set(sg, r); }
          const k = B.kulcs(r, cel);
          if (!legjobb || hasonlit(k, legjobb.k) < 0) legjobb = { k, boxes, r, d };
        }
      }
      if (!legjobb) return null;
      const { boxes, r, d } = legjobb;
      const kimaradt = d.r.kimaradt.map(({ id, kod }) => ({ id, kod, szoveg: kimaradtSzoveg(byId.get(id), kod) }));
      const teljes = kimaradt.length === 0;
      const m = r.mutatok || {};
      return {
        cel, nev: { A: 'A terv – Ajánlott (biztonság → lerakodás → hossz)', B: 'B terv – Legkisebb helyigény', C: 'C terv – Legnagyobb biztonsági tartalék' }[cel],
        generalva: true, trailer: { ...t }, boxes, kimaradt, teljes,
        allapot: r.ok ? (teljes ? r.allapot : E.ALLAPOT.RESZLEGES) : E.ALLAPOT.ERVENYTELEN,
        allapotSzoveg: !r.ok ? `ÉRVÉNYTELEN – ${r.hibak.length} kemény szabálysértés` : teljes ? r.allapot : 'RÉSZLEGES – nem teljes rakományterv',
        ellenorzes: { ok: r.ok, hibak: r.hibak.map(({ kod, szoveg, dobozok: db }) => ({ kod, szoveg, dobozok: db })), figyelmeztetesek: r.figyelmeztetesek.map(({ kod, szoveg, dobozok: db }) => ({ kod, szoveg, dobozok: db })) },
        osszegzes: { kemenyHiba: r.hibak.length, figyelmeztetes: r.figyelmeztetesek.length, atrakas: m.atrakas ?? 0, tartalekPct: m.tartalekPct ?? null, tartalekMi: m.tartalekMi ?? null, lerakodasiIdoS: m.lerakodasiIdoS ?? 0, pantDb: m.rogzites?.pantDb ?? 0, sulypont: m.sulypont || null, tengelyMaxPct: m.tengely ? Math.max(...m.tengely.tengelyek.map((a) => a.kihasznaltsagPct)) : null },
        fizikaiHosszCm: r.hosszCm, elhelyezett: d.r.helyek.size, osszes: units.length, sorrendNev: d.nev, talalvaMs: d.idoMs, talalvaIter: d.iter, kulcs: legjobb.k,
      };
    }
    function kimaradtSzoveg(u, kod) {
      if (kod === 'NEM_FER_BE') return `${nev(u)}: ${u.length} × ${u.width} × ${u.height} cm – semmilyen megengedett orientációban nem fér be a ${t.length} × ${t.width} × ${t.height} cm-es rakodótérbe.`;
      if (kod === 'TETO_RES') return `${nev(u)}: ${u.height} cm magas, a tető alatti ${C.tetoResCm} cm-es szabad rés miatt legfeljebb ${t.height - C.tetoResCm} cm lehet.`;
      if (kod === 'AJTO_MERET') return `${nev(u)}: nem fér át a ${P.ajtoSzelessegCm} × ${P.ajtoMagassagCm} cm-es ajtón (vagy oldalról lenne lerakva, de a jármű oldala nem nyitható).`;
      if (kod === 'KEZELES_IRANY') return `${nev(u)}: a megengedett orientációkban a villanyílás nem néz a kivételi irány felé.`;
      if (kod === 'HASZNOS_TEHER_TULLEPES') return `${nev(u)}: ${hu(u.weight)} kg – elhelyezésével az elhelyezett tömeg túllépné a ${hu(t.payloadKg)} kg hasznos terhet.`;
      return `${nev(u)}: nem található olyan hely, amely a méret-, halmozási, törékenységi, terhelési és átrakás nélküli lerakodási szabályoknak egyszerre megfelel.`;
    }
    function eredmeny() {
      const figy = [], javaslatok = [];
      const ossz = units.reduce((s, u) => s + u.weight, 0);
      if (ossz > t.payloadKg) figy.push(`Az össztömeg (${hu(ossz)} kg) meghaladja a jármű hasznos terhét (${hu(t.payloadKg)} kg): a teljes rakomány ezzel a járművel nem teljesíthető.`);
      const tervek = { A: tervOsszeallit('A'), B: tervOsszeallit('B'), C: tervOsszeallit('C') };
      const sig = (p) => p && JSON.stringify(p.boxes.map((b) => [b.x, b.y, b.z, b.rot, b.placed]));
      if (tervek.A && tervek.B && sig(tervek.A) === sig(tervek.B)) tervek.B.azonosAzA = true;
      if (tervek.A && tervek.C && sig(tervek.A) === sig(tervek.C)) tervek.C.azonosAzA = true;
      const A = tervek.A;
      if (A && (!A.teljes || !A.ellenorzes.ok)) {
        javaslatok.push('A kemény szabályokból a program nem enged. Lehetőségek:');
        if (!A.teljes) javaslatok.push('• Második jármű, vagy nagyobb jármű (pl. Mega félpótkocsi / nagyobb hasznos teher) a kimaradt egységekre.');
        if (S.van) javaslatok.push('• Más lerakósorrend vagy oldalsó lerakodás (függönyös jármű) a hozzáférhetőség javítására.');
        javaslatok.push('• A törékenységi, halmozási és terhelhetőségi adatok ellenőrzése – túl szigorú adat feleslegesen kizárhat halmozást.');
        if (A.ellenorzes.hibak.some((h) => ['TENGELYTERHELES', 'SULYPONT_HOSSZ', 'KORMANYZOTT_TENGELY'].includes(h.kod))) javaslatok.push('• Tengelyterhelés: a nehéz egységek eloszlását vagy a jármű tényleges tengelyadatait ellenőrizd (a sablonértékek tájékoztatóak).');
      }
      return {
        profi: true, mod: modKulcs, modNev: M.nev, seed, iteracio: iter, idoMs: most() - start, idokorlatMs: idokorlat,
        megszakitva, idoLejart, alsoKorlatCm: lb, alapHosszCm: null, heurisztikus: true, megjegyzes: MEGJEGYZES, figyelmeztetesek: figy, javaslatok, tervek,
      };
    }
    return { lepes, allapot, megszakit, eredmeny };
  }

  function optimalizal(terv, beall = {}) {
    const k = keresesInditas(terv, beall);
    while (!k.lepes(1e9).kesz);
    return k.eredmeny();
  }

  return { MODOK, MEGJEGYZES, formak, elhelyez, oldalKiegyenlit, hosszIgazit, keresesInditas, optimalizal };
});
