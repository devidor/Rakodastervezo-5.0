/*
 * Rakománytervező 3D V07 – szétosztás több járműre (flotta, Jumbo szerelvény)
 * ----------------------------------------------------------------------------
 * Cél (sorrendben): minden egység elhelyezve → a lehető legkevesebb jármű → egy lerakó lehetőleg egy járműre →
 * járművenként a V07 profi optimalizáló legjobb (kemény hiba nélküli) terve.
 *
 * Módszer (heurisztika, lépésenként futtatható – Web Workerben és fő szálon is):
 *   1. Csoportok: lerakónként (a lerakó nélküliek egy csoportban), lerakósorrendben – így egy jármű
 *      egymást követő lerakókat kap.
 *   2. Járművenként sorban: a csoportokat egyben próbálja hozzáadni (gyors előszűrés: tömeg, alsó hosszkorlát;
 *      majd tényleges profi optimalizálás). Csak akkor fogad el egy bővítést, ha minden egység elfér és
 *      nincs kemény szabálysértés.
 *   3. Ha egy csoport egyben már nem fér el, „lerakó egyben” = 'elonyben' módban a maradék helyet a csoport egy
 *      részével tölti ki (a lerakó két járműre kerül); 'kotelezo' módban csak akkor bont, ha a csoport üres
 *      járműbe sem fér.
 *   4. A végén minden járművet a választott üzemmódban újraoptimalizál.
 * Az eredmény heurisztikus: kevés járművet és szabályos terveket keres, de nem igazolt optimum.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./optimalizalo_profi.js'), require('./optimalizalo.js'), require('./lerakodas.js'), require('./jarmu.js'), require('./biztonsag.js'));
  else root.Flotta = factory(root.OptimalizaloProfi, root.Optimalizalo, root.Lerakodas, root.Jarmu, root.Biztonsag);
})(typeof self !== 'undefined' ? self : this, function (OP, O, L, J, B) {
  'use strict';

  const hu = (n, d = 0) => Number(n).toLocaleString('hu-HU', { maximumFractionDigits: d });

  /** Jármű megadása: sablonnév vagy teljes trailer-objektum. */
  function jarmuObj(j) {
    if (typeof j === 'string') {
      const s = J.SABLONOK[j];
      if (!s) throw new Error(`Ismeretlen járműtípus: ${j}`);
      return { type: j, length: s.length, width: s.width, height: s.height, payloadKg: s.payloadKg };
    }
    return JSON.parse(JSON.stringify(j));
  }

  /**
   * Járműlista kibontása.
   * @param {{mod:'auto'|'jumbo'|'lista', jarmu?:object|string, max?:number, lista?:{jarmu, db}[]}} spec
   */
  function jarmuLista(spec) {
    if (spec.mod === 'jumbo') {
      const out = [];
      for (let i = 0; i < (spec.max || 2); i++) {
        out.push({ ...jarmuObj('Jumbo – motorkocsi raktér'), szerelveny: i + 1, resz: 'motorkocsi' });
        out.push({ ...jarmuObj('Jumbo – pótkocsi raktér'), szerelveny: i + 1, resz: 'pótkocsi' });
      }
      return out;
    }
    if (spec.mod === 'lista') return (spec.lista || []).flatMap((s) => Array.from({ length: Math.max(0, s.db | 0) }, () => jarmuObj(s.jarmu)));
    return Array.from({ length: Math.max(1, spec.max || 10) }, () => jarmuObj(spec.jarmu));
  }

  /** Becsült alsó korlát a járműszámra (tömeg és a halmozással korrigált padlóterület alapján). */
  function alsoKorlat(units, t) {
    const tomeg = units.reduce((s, u) => s + u.weight, 0);
    const lbT = Math.ceil(tomeg / t.payloadKg - 1e-9);
    const lbL = Math.ceil(O.alsoKorlat(t, units) / t.length - 1e-9);
    return { jarmu: Math.max(1, lbT, lbL), tomegAlapjan: lbT, hosszAlapjan: lbL, tomegKg: tomeg };
  }

  /**
   * Lépésenkénti szétosztás.
   * @param {{trailer?:object, boxes:object[]}} terv  a teljes rakomány (az elhelyezés nem számít)
   * @param {object} spec  járművek (lásd jarmuLista)
   * @param {{mod?:string, seed?:number, cfg?:object, lerakoEgyben?:'elonyben'|'kotelezo', proba?:object}} beall
   */
  function szetosztInditas(terv, spec, beall = {}) {
    const jarmuvek = jarmuLista(spec);
    if (!jarmuvek.length) throw new Error('Nincs megadva jármű.');
    const units = terv.boxes.map((b) => ({ ...b, placed: false, x: 0, y: 0, z: 0 }));
    const egyben = beall.lerakoEgyben === 'kotelezo' ? 'kotelezo' : 'elonyben';
    const proba = { mod: 'gyors', veletlenIter: 0, idokorlatMs: 1500, seed: beall.seed ?? 20261126, cfg: beall.cfg || {}, ...(beall.proba || {}) };
    const vegso = { mod: beall.mod || 'gyors', seed: beall.seed ?? 20261126, cfg: beall.cfg || {}, ...(beall.idokorlatMs ? { idokorlatMs: beall.idokorlatMs } : {}) };
    const S = L.stopok(units);
    // Csoportok lerakósorrendben.
    const csopMap = new Map();
    for (const u of units) { const k = S.eff(u); if (!csopMap.has(k)) csopMap.set(k, []); csopMap.get(k).push(u); }
    let csoportok = [...csopMap.entries()].sort((a, b) => a[0] - b[0]).map(([stop, lista]) => ({ stop, lista }));
    const eredmenyek = [], nemFer = [];
    let ji = 0, kesz = false, lepesDb = 0, aktualis = null, uzenet = 'Indítás…';
    const start = Date.now();

    const probal = (t, lista) => {
      lepesDb++;
      const tomeg = lista.reduce((s, u) => s + u.weight, 0);
      if (tomeg > t.payloadKg) return null;
      if (O.alsoKorlat(t, lista) > t.length) return null;
      const er = OP.optimalizal({ trailer: t, boxes: lista }, proba);
      return er.tervek.A;
    };
    const elfogad = (A, n) => A && A.teljes && A.ellenorzes.ok && A.elhelyezett === n;

    function jarmuKezd() {
      if (ji >= jarmuvek.length || !csoportok.length) { kesz = true; return; }
      aktualis = { t: jarmuvek[ji], lista: [], csopIdx: 0, terv: null, bontott: false };
    }
    /** Egy lépés: egy csoport (vagy csoportrész) kipróbálása az aktuális járművön. */
    function egyLepes() {
      if (kesz) return;
      if (!aktualis) { jarmuKezd(); if (kesz) return; }
      const a = aktualis;
      if (a.csopIdx >= csoportok.length) { jarmuZar(); return; }
      const cs = csoportok[a.csopIdx];
      uzenet = `${ji + 1}. jármű (${a.t.type}): ${cs.stop <= S.max && S.van ? cs.stop + '. lerakó' : 'lerakó nélküli egységek'} próbája…`;
      const egesz = a.lista.concat(cs.lista);
      const A = probal(a.t, egesz);
      if (elfogad(A, egesz.length)) {
        a.lista = egesz; a.terv = A;
        csoportok.splice(a.csopIdx, 1);
        return;
      }
      // Nem fér egyben: bontás, ha a mód engedi (vagy ha a jármű még üres – különben sosem kerülne fel).
      if (egyben === 'elonyben' || a.lista.length === 0) {
        // A csoport első k egysége (nagyobb, nehezebb előbb): bináris keresés a legnagyobb elférő k-ra,
        // úgy, hogy a járműre már felkerült egységek mind bent maradnak, és nincs kemény szabálysértés.
        const rend = cs.lista.slice().sort((p, q) => q.length * q.width - p.length * p.width || q.weight - p.weight || p.id - q.id);
        let lo = 1, hi = rend.length - 1, legjobb = 0, legjobbA = null;
        while (lo <= hi) {
          const k = (lo + hi) >> 1, lst = a.lista.concat(rend.slice(0, k)), r = probal(a.t, lst);
          if (elfogad(r, lst.length)) { legjobb = k; legjobbA = r; lo = k + 1; } else hi = k - 1;
        }
        if (legjobb > 0) {
          a.lista = a.lista.concat(rend.slice(0, legjobb)); a.terv = legjobbA; a.bontott = true;
          cs.lista = rend.slice(legjobb);
          jarmuZar(); // a jármű tele: a további csoportokat már nem próbáljuk ide
          return;
        }
      }
      // Üres járműbe sem fér egyetlen egység sem a csoportból: kimarad (a többi csoport mehet tovább).
      // Az önmagában sem férő egységek kimaradnak, a csoport többi része újra próbálkozik ugyanezen a járművön.
      if (a.lista.length === 0) {
        const jo = cs.lista.filter((u) => elfogad(probal(a.t, [u]), 1));
        nemFer.push(...cs.lista.filter((u) => !jo.includes(u)));
        if (jo.length && jo.length < cs.lista.length) cs.lista = jo;
        else csoportok.splice(a.csopIdx, 1);
        return;
      }
      // Kötelező egyben tartás: a következő (kisebb) csoport még elférhet.
      if (egyben === 'kotelezo') { a.csopIdx++; return; }
      jarmuZar();
    }
    function jarmuZar() {
      const a = aktualis; aktualis = null;
      if (a && a.lista.length) eredmenyek.push({ t: a.t, lista: a.lista, terv: a.terv, bontott: a.bontott });
      ji++;
      if (ji >= jarmuvek.length || !csoportok.length) kesz = true;
    }
    function lepes(budgetMs = 200) {
      const vege = Date.now() + budgetMs;
      do { egyLepes(); } while (!kesz && Date.now() < vege);
      return allapot();
    }
    function allapot() {
      const maradek = csoportok.reduce((s, c) => s + c.lista.length, 0);
      return { kesz, jarmu: eredmenyek.length + (aktualis ? 1 : 0), elhelyezett: units.length - maradek, osszes: units.length, lepes: lepesDb, idoMs: Date.now() - start, uzenet };
    }
    function eredmeny() {
      // Végső optimalizálás járművenként a választott üzemmódban (ha nem rosszabb, mint a próba).
      const jarmuLst = eredmenyek.map((e, i) => {
        let A = e.terv;
        if (vegso.mod !== 'gyors' || vegso.idokorlatMs) {
          const v = OP.optimalizal({ trailer: e.t, boxes: e.lista.map((u) => ({ ...u, placed: false })) }, vegso).tervek.A;
          if (v && B.kulcs && v.teljes && v.ellenorzes.ok && (!A || compare(v.kulcs, A.kulcs) <= 0)) A = v;
        }
        const pl = A.boxes.filter((b) => b.placed);
        const stopok = [...new Set(pl.map((b) => b.stop ?? null))].sort((x, y) => (x ?? 999) - (y ?? 999));
        return {
          index: i + 1, nev: `${i + 1}. jármű – ${e.t.type}${e.t.szerelveny ? ` (${e.t.szerelveny}. szerelvény, ${e.t.resz})` : ''}`,
          trailer: e.t, boxes: A.boxes, stopok, darab: pl.length, tomegKg: pl.reduce((s, b) => s + b.weight, 0),
          hosszCm: A.fizikaiHosszCm, allapot: A.allapot, allapotSzoveg: A.allapotSzoveg, osszegzes: A.osszegzes, bontottLerako: e.bontott,
          hibak: A.ellenorzes.hibak, figyelmeztetesek: A.ellenorzes.figyelmeztetesek,
        };
      });
      const bentIds = new Set(jarmuLst.flatMap((j) => j.boxes.filter((b) => b.placed).map((b) => b.id)));
      const kimaradt = units.filter((u) => !bentIds.has(u.id));
      const figy = [];
      // Lerakók megosztása járművek között.
      const stopJarmu = new Map();
      for (const j of jarmuLst) for (const s of j.stopok) if (s != null) { if (!stopJarmu.has(s)) stopJarmu.set(s, []); stopJarmu.get(s).push(j.index); }
      const osztott = [...stopJarmu].filter(([, l]) => l.length > 1);
      if (osztott.length) figy.push(`Több járműre került lerakó: ${osztott.map(([s, l]) => `${s}. (${l.join(' + ')}. jármű)`).join(', ')} – ezeken a lerakókon több jármű áll meg.`);
      if (kimaradt.length) figy.push(`${kimaradt.length} egység nem fért el a megadott járművekben (${hu(kimaradt.reduce((s, u) => s + u.weight, 0))} kg) – adj meg több vagy nagyobb járművet.`);
      // Jumbo szerelvény: együttes össztömeg (40 t) ellenőrzése.
      const szerelvenyek = new Map();
      for (const j of jarmuLst) if (j.trailer.szerelveny) { const k = j.trailer.szerelveny; if (!szerelvenyek.has(k)) szerelvenyek.set(k, []); szerelvenyek.get(k).push(j); }
      const szerelvenyOssz = [];
      for (const [k, l] of szerelvenyek) {
        let ossz = 0;
        for (const j of l) { const tg = J.tengelyek(j.trailer, j.boxes.filter((b) => b.placed).map((b) => ({ kg: b.weight, x: b.x + (b.rot ? b.width : b.length) / 2 }))); ossz += tg.ossztomegKg; }
        szerelvenyOssz.push({ szerelveny: k, ossztomegKg: ossz, maxKg: 40000, ok: ossz <= 40000 });
        if (ossz > 40000) figy.push(`A(z) ${k}. Jumbo szerelvény becsült össztömege ${hu(ossz)} kg > 40 000 kg.`);
      }
      const lb = alsoKorlat(units, jarmuvek[0]);
      return {
        jarmuvek: jarmuLst, jarmuDb: jarmuLst.length, kimaradt: kimaradt.map((u) => u.id), alsoKorlat: lb, figyelmeztetesek: figy, szerelvenyek: szerelvenyOssz,
        osszesEgyseg: units.length, lepesek: lepesDb, idoMs: Date.now() - start, lerakoEgyben: egyben,
        megjegyzes: 'Heurisztikus szétosztás: kevés járművet és szabályos járművenkénti terveket keres, de nem igazolt optimum.',
      };
    }
    const compare = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = a[i] ?? 0, y = b[i] ?? 0; if (x !== y) return x < y ? -1 : 1; } return 0; };
    return { lepes, allapot, eredmeny };
  }

  function szetoszt(terv, spec, beall = {}) {
    const k = szetosztInditas(terv, spec, beall);
    while (!k.lepes(1e9).kesz);
    return k.eredmeny();
  }

  return { jarmuLista, alsoKorlat, szetosztInditas, szetoszt };
});
