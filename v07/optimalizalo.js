/*
 * Rakománytervező 3D V06 – automatikus rakományoptimalizáló (3D bin packing heurisztika)
 * -------------------------------------------------------------------------------------
 * Módszer:
 *   - Extreme Point-alapú elhelyezés: minden elhelyezett egység sarkaiból új jelölt pontok (x, y, z irányban),
 *     a bal fal és a homlokfal felé vetítve (üres tér alapú rés-kitöltés).
 *   - Best Fit pontozás: a jelölt (pont × orientáció) közül a lexikografikusan legjobb:
 *     [fizikai helyigény az elhelyezés után, x, z, y] – a szélesség, majd a halmozás kitöltése a hossz növelése előtt.
 *   - First Fit Decreasing kezdő sorrendek több rendezési kulccsal, majd seedelt véletlen greedy keresés
 *     (sorrend-perturbáció) az idő- / iterációkorlátig.
 *   - Halmozás csak a V06 szabályai szerint: teljes alátámasztás egyetlen alsó egységen, szintkorlát az oszlop
 *     minden tagjára, ismert felső terhelhetőség (ismeretlennél NINCS automatikus halmozás).
 * Az eredmény heurisztikus: „a talált legjobb terv”, nem igazoltan optimális.
 * Az időmérés és a megszakítás a lepes() hívásokon keresztül történik (Web Worker és fő szálas tartalék is ezt használja).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./geometria.js'), require('./ellenorzo.js'), require('./szabad_ter.js'));
  else root.Optimalizalo = factory(root.Geometria, root.Ellenorzo, root.SzabadTer);
})(typeof self !== 'undefined' ? self : this, function (G, E, SZ) {
  'use strict';

  const MODOK = Object.freeze({
    gyors: { nev: 'Gyors optimalizálás', idoMs: 1000, veletlenIter: 0 },
    intelligens: { nev: 'Intelligens optimalizálás', idoMs: 5000, veletlenIter: 300 },
    maximalis: { nev: 'Maximális helykihasználás', idoMs: 30000, veletlenIter: 3000 },
  });
  const MEGJEGYZES = 'Heurisztikus keresés eredménye: a talált legjobb érvényes terv, nem igazoltan matematikai optimum.';

  /** Reprodukálható álvéletlen-generátor (mulberry32). */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const most = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  const hasonlit = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; return 0; };
  const yAtfed = (a, b) => a.y0 < b.y1 && a.y1 > b.y0;
  const nev = (u) => (u.label ? `${u.label} (#${u.id})` : `${u.id}. doboz`);
  const hu = (n) => Number(n).toLocaleString('hu-HU', { maximumFractionDigits: 1 });

  // --- Halmozási és sorrendi feltételek -----------------------------------------------------------------------
  function halmozhato(u, also) {
    if (!E.felulreTeheto(u) || !E.raTeheto(also.u)) return false;
    const ujSzint = also.szint + 1;
    if (ujSzint > E.szintKorlat(u)) return false;
    for (let r = also; r; r = r.also) {
      if (r.u.maxLoadKg === null || r.teher + u.weight > r.u.maxLoadKg) return false; // ismeretlen → tilos
      if (ujSzint > E.szintKorlat(r.u)) return false;
    }
    return true;
  }
  function sorrendOk(u, v, rec) {
    for (const r of rec.values()) if (r.u.stop > u.stop && r.v.x0 >= v.x1 && yAtfed(r.v, v)) return false;
    return true;
  }

  /**
   * Egy greedy elhelyezési menet adott sorrendben.
   * @returns {{helyek:Map, kimaradt:{id,kod}[], maxX:number, tomeg:number}}
   */
  function elhelyez(t, sorrend, beall = {}) {
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
    for (const u of sorrend) {
      const rots = G.orientaciok(beall.forgatas === false ? { ...u, rotatable: false } : u, t);
      if (!rots.length) { kimaradt.push({ id: u.id, kod: 'NEM_FER_BE' }); continue; }
      if (tomeg + u.weight > t.payloadKg) { kimaradt.push({ id: u.id, kod: 'HASZNOS_TEHER_TULLEPES' }); continue; }
      const minL = Math.min(...rots.map((r) => G.meretek(u, r).l));
      let best = null;
      for (const p of pontok) {
        if (p.z > 0 && beall.halmozas === false) continue;
        if (best && Math.max(maxX, p.x + minL) > best.s[0]) continue;
        for (const r of rots) {
          const v = G.doboz(u, p.x, p.y, p.z, r);
          if (v.x1 > t.length || v.y1 > t.width || v.z1 > t.height) continue;
          const s = [Math.max(maxX, v.x1), v.x0, v.z0, v.y0];
          if (best && hasonlit(s, best.s) >= 0) continue;
          if (idx.utkozik(v)) continue;
          let also = null;
          if (v.z0 > 0) {
            const e = idx.alatamaszto(v);
            if (!e || !halmozhato(u, e.adat)) continue;
            also = e.adat;
          }
          if (beall.sorrend && !sorrendOk(u, v, rec)) continue;
          best = { s, v, r, also };
        }
      }
      if (!best) { kimaradt.push({ id: u.id, kod: 'NINCS_SZABAD_HELY' }); continue; }
      const { v, r, also } = best;
      const ra = { u, v, szint: also ? also.szint + 1 : 1, also, teher: 0 };
      for (let q = also; q; q = q.also) q.teher += u.weight;
      idx.hozzaad(u.id, v, ra); rec.set(u.id, ra);
      helyek.set(u.id, { x: v.x0, y: v.y0, z: v.z0, rot: r });
      maxX = Math.max(maxX, v.x1); tomeg += u.weight;
      // Új extrém pontok + vetítéseik; a most lefedett pontok törlése.
      const uj = [[v.x1, v.y0, v.z0], [v.x0, v.y1, v.z0], [v.x1, vetitY(v.x1, v.y0, v.z0), v.z0], [vetitX(v.x0, v.y1, v.z0), v.y1, v.z0]];
      if (E.raTeheto(u)) uj.push([v.x0, v.y0, v.z1]);
      pontok = pontok.filter((p) => !(v.x0 <= p.x && p.x < v.x1 && v.y0 <= p.y && p.y < v.y1 && v.z0 <= p.z && p.z < v.z1));
      for (const [x, y, z] of uj) {
        if (x >= t.length || y >= t.width || z >= t.height) continue;
        if (pontok.some((p) => p.x === x && p.y === y && p.z === z) || bent(x, y, z)) continue;
        pontok.push({ x, y, z });
      }
    }
    return { helyek, kimaradt, maxX, tomeg };
  }

  // --- Segédek ------------------------------------------------------------------------------------------------
  function elokeszit(terv) {
    return terv.boxes.map((b) => ({ ...E.normalizal(b), placed: false, x: 0, y: 0, z: 0 }));
  }
  /** Becsült alsó korlát a fizikai helyigényre (cm) – nem állítja, hogy elérhető. */
  function alsoKorlat(t, units) {
    const elhelyezheto = units.filter((u) => G.orientaciok(u, t).length);
    if (!elhelyezheto.length) return 0;
    const V = elhelyezheto.reduce((s, u) => s + u.length * u.width * u.height, 0);
    const lbV = Math.ceil(V / (t.width * t.height));
    // Oszloponként: a k tagú oszlop minden véges korlátú tagjára k ≤ korlát, így Σ alapterület / korlát ≤ az oszlop alapterülete.
    // Ha egy egység semmilyen másik egység tetejére nem kerülhet, a padlón áll, és nincs rajta semmi → teljes alapterülete beszámít.
    const fedheti = (also, u) => [0, 1].some((ra) => (ra === 0 || also.rotatable !== false) && [0, 1].some((rf) => {
      if (rf === 1 && u.rotatable === false) return false;
      const a = G.meretek(also, ra), f = G.meretek(u, rf);
      return f.l <= a.l && f.w <= a.w;
    }));
    const felulreKerulhet = (u) => E.felulreTeheto(u) && elhelyezheto.some((v) => v !== u && E.mod(v) === 'szint' && v.maxLoadKg !== null && v.maxLoadKg >= u.weight && v.height + u.height <= t.height && fedheti(v, u));
    const oszto = (u) => (E.mod(u) === 'szint' ? u.maxLayers : felulreKerulhet(u) ? Infinity : 1);
    const lbA = Math.ceil(elhelyezheto.reduce((s, u) => s + u.length * u.width / oszto(u), 0) / t.width);
    const lbL = Math.max(...elhelyezheto.map((u) => Math.min(...G.orientaciok(u, t).map((r) => G.meretek(u, r).l))));
    return Math.max(lbV, lbA, lbL);
  }
  const KULCSOK = [
    ['alapterület', (u) => u.length * u.width],
    ['térfogat', (u) => u.length * u.width * u.height],
    ['magasság', (u) => u.height],
    ['leghosszabb él', (u) => Math.max(u.length, u.width)],
    ['súly', (u) => u.weight],
    ['padlóra kötött előre', (u) => (E.mod(u) === 'nem' ? 1e12 : 0) + u.length * u.width],
  ];
  const rendez = (units, kulcs, zaj = null, stopElore = false) => {
    const k = new Map(units.map((u) => [u.id, kulcs(u) * (zaj ? 1 + zaj() : 1)]));
    return units.slice().sort((a, b) => (stopElore ? b.stop - a.stop : 0) || k.get(b.id) - k.get(a.id) || a.id - b.id);
  };

  /**
   * Keresés indítása. A lepes(budgetMs) addig fut, amíg az időkeret el nem fogy, és jelzi, kész-e.
   * @param {{trailer, boxes}} terv
   * @param {{mod?:'gyors'|'intelligens'|'maximalis', seed?:number, idokorlatMs?:number, veletlenIter?:number, alapterv?:boolean}} beall
   */
  function keresesInditas(terv, beall = {}) {
    const modKulcs = MODOK[beall.mod] ? beall.mod : 'gyors', M = MODOK[modKulcs];
    const idokorlat = beall.idokorlatMs ?? M.idoMs, veletlenMax = beall.veletlenIter ?? M.veletlenIter;
    const seed = (beall.seed ?? 20261126) >>> 0, rnd = mulberry32(seed);
    const t = terv.trailer, units = elokeszit(terv), byId = new Map(units.map((u) => [u.id, u]));
    const lb = alsoKorlat(t, units);
    const vanStop = units.length > 0 && units.every((u) => u.stop !== null);
    const reszStop = !vanStop && units.some((u) => u.stop !== null);
    const start = most();
    let iter = 0, veletlen = 0, kesz = units.length === 0, megszakitva = false, idoLejart = false;
    const best = { A: null, B: null, C: null };
    const sor = [];
    for (const [n, k] of KULCSOK) sor.push({ cel: 'AB', nev: 'FFD: ' + n, sorrend: rendez(units, k) });
    sor.push({ cel: 'AB', nev: 'bemeneti sorrend', sorrend: units.slice() });
    if (vanStop) for (const [n, k] of KULCSOK) sor.push({ cel: 'C', nev: 'lerakó + ' + n, sorrend: rendez(units, k, null, true) });

    const alap = beall.alapterv === false ? null : elhelyez(t, units, { forgatas: false, halmozas: false });

    function ertekel(cel, sorrend, nevS) {
      const r = elhelyez(t, sorrend, { sorrend: cel === 'C' });
      const db = r.helyek.size, ido = most() - start;
      const jelolt = { r, sorrend, nev: nevS, idoMs: ido, iter };
      if (cel === 'C') {
        if (!best.C || hasonlit([-db, r.maxX], best.C.k) < 0) best.C = { ...jelolt, k: [-db, r.maxX] };
        return;
      }
      if (!best.A || hasonlit([-db, r.maxX], best.A.k) < 0) best.A = { ...jelolt, k: [-db, r.maxX] };
      // B: legnagyobb összefüggő szabad tér – csak a legjobb hossz közelében értékelve (költséges).
      if (best.A && -db === best.A.k[0] && r.maxX <= best.A.k[1] * 1.1 + 1) {
        const dobozok = [...r.helyek].map(([id, p]) => G.doboz(byId.get(id), p.x, p.y, p.z, p.rot));
        const lt = SZ.legnagyobbTer(t, dobozok, 20).terfogatCm3;
        const k = [-db, -lt, r.maxX];
        if (!best.B || hasonlit(k, best.B.k) < 0) best.B = { ...jelolt, k, legnagyobbSzabadCm3: lt };
      }
    }
    function kovetkezo() {
      if (sor.length) { const s = sor.shift(); ertekel(s.cel === 'C' ? 'C' : 'AB', s.sorrend, s.nev); return; }
      veletlen++;
      const cC = vanStop && veletlen % 3 === 0;
      const alapSor = (cC ? best.C : best.A)?.sorrend || units;
      let sorrend;
      if (rnd() < 0.5) {
        sorrend = alapSor.slice();
        const csere = 1 + Math.floor(rnd() * 3);
        for (let i = 0; i < csere; i++) {
          const a = Math.floor(rnd() * sorrend.length), b = Math.floor(rnd() * sorrend.length);
          if (cC && sorrend[a].stop !== sorrend[b].stop) continue; // C: csak lerakón belül
          [sorrend[a], sorrend[b]] = [sorrend[b], sorrend[a]];
        }
      } else {
        const k = KULCSOK[Math.floor(rnd() * KULCSOK.length)][1];
        sorrend = rendez(units, k, () => 0.4 * (rnd() - 0.5), cC);
      }
      ertekel(cC ? 'C' : 'AB', sorrend, 'véletlen #' + veletlen);
    }
    function vegeE() {
      if (most() - start >= idokorlat) { idoLejart = true; return true; }
      if (sor.length) return false;
      if (veletlen >= veletlenMax) return true;
      // Korai leállás: minden elhelyezve, és az A terv elérte az alsó korlátot (C-t ilyenkor is tovább nem javítjuk).
      if (best.A && best.A.k[0] === -units.length && best.A.k[1] <= lb && (!vanStop || (best.C && best.C.k[1] <= lb))) return true;
      return false;
    }

    function lepes(budgetMs = 50) {
      const vege = most() + budgetMs;
      while (!kesz && most() < vege) {
        kovetkezo(); iter++;
        if (vegeE()) kesz = true;
      }
      return allapot();
    }
    function allapot() {
      return {
        kesz, iter, idoMs: most() - start, idokorlatMs: idokorlat,
        legjobbHosszCm: best.A ? best.A.r.maxX : null, elhelyezett: best.A ? best.A.r.helyek.size : 0, osszes: units.length, alsoKorlatCm: lb,
      };
    }
    function megszakit() { megszakitva = !kesz; kesz = true; }

    function tervOsszeallit(cel) {
      const b = best[cel];
      if (!b) return null;
      const boxes = units.map((u) => {
        const p = b.r.helyek.get(u.id);
        return p ? { ...u, placed: true, x: p.x, y: p.y, z: p.z, rot: p.rot } : { ...u, placed: false, x: 0, y: 0, z: 0 };
      });
      const ell = E.ellenoriz({ trailer: t, boxes }, { sorrend: cel === 'C' });
      const kimaradt = b.r.kimaradt.map(({ id, kod }) => {
        const u = byId.get(id);
        let szoveg;
        if (kod === 'NEM_FER_BE') {
          szoveg = `${nev(u)}: ${u.length} × ${u.width} × ${u.height} cm – semmilyen megengedett orientációban nem fér be a ${t.length} × ${t.width} × ${t.height} cm-es rakodótérbe.`;
          if (u.rotatable === false && G.orientaciok({ ...u, rotatable: true }, t).length) szoveg += ' (90°-ban beférne, de nem forgatható.)';
        } else if (kod === 'HASZNOS_TEHER_TULLEPES') szoveg = `${nev(u)}: ${hu(u.weight)} kg – elhelyezésével az elhelyezett tömeg túllépné a ${hu(t.payloadKg)} kg hasznos terhet.`;
        else szoveg = `${nev(u)}: nem található érvényes szabad hely a méret-, halmozási és alátámasztási szabályok szerint.`;
        return { id, kod, szoveg };
      });
      const teljes = kimaradt.length === 0;
      return {
        cel, nev: { A: 'A terv – Minimális helyigény', B: 'B terv – Maximális bővíthetőség', C: 'C terv – Lerakodási sorrend' }[cel],
        generalva: true, trailer: { ...t }, boxes, kimaradt, teljes,
        allapot: ell.ok ? (teljes ? ell.allapot : E.ALLAPOT.RESZLEGES) : E.ALLAPOT.ERVENYTELEN,
        allapotSzoveg: !ell.ok ? 'ÉRVÉNYTELEN' : teljes ? ell.allapot : 'RÉSZLEGES – nem teljes rakományterv',
        ellenorzes: { ok: ell.ok, hibak: ell.hibak, figyelmeztetesek: ell.figyelmeztetesek },
        fizikaiHosszCm: b.r.maxX, elhelyezett: b.r.helyek.size, osszes: units.length,
        legnagyobbSzabadCm3: b.legnagyobbSzabadCm3 ?? null, sorrendNev: b.nev, talalvaMs: b.idoMs, talalvaIter: b.iter,
      };
    }
    function eredmeny() {
      const figy = [];
      const ossz = units.reduce((s, u) => s + u.weight, 0);
      if (ossz > t.payloadKg) figy.push(`Az össztömeg (${hu(ossz)} kg) meghaladja a jármű hasznos terhét (${hu(t.payloadKg)} kg): a teljes rakomány ezzel a járművel nem teljesíthető.`);
      const A = tervOsszeallit('A'), B = tervOsszeallit('B');
      if (A && B && JSON.stringify(A.boxes.map((b) => [b.x, b.y, b.z, b.rot, b.placed])) === JSON.stringify(B.boxes.map((b) => [b.x, b.y, b.z, b.rot, b.placed]))) B.azonosAzA = true;
      const C = vanStop ? tervOsszeallit('C') : { cel: 'C', nev: 'C terv – Lerakodási sorrend', generalva: false, ok: reszStop ? 'Nem minden egységhez van megadva lerakóhely, ezért a C terv nem készült el.' : 'Nincs megadva lerakodási sorrend, ezért a C terv nem készült el.' };
      return {
        mod: modKulcs, modNev: M.nev, seed, iteracio: iter, idoMs: most() - start, idokorlatMs: idokorlat,
        megszakitva, idoLejart, alsoKorlatCm: lb, alapHosszCm: alap && alap.kimaradt.length === 0 ? alap.maxX : null,
        heurisztikus: true, megjegyzes: MEGJEGYZES, figyelmeztetesek: figy,
        tervek: { A, B, C },
      };
    }
    return { lepes, allapot, megszakit, eredmeny };
  }

  /** Szinkron futtatás (Node-tesztek, kis feladatok). */
  function optimalizal(terv, beall = {}) {
    const k = keresesInditas(terv, beall);
    while (!k.lepes(1e9).kesz);
    return k.eredmeny();
  }

  return { MODOK, MEGJEGYZES, mulberry32, elhelyez, alsoKorlat, keresesInditas, optimalizal };
});
