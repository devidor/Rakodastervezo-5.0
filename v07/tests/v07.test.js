// Rakománytervező 3D V07 – automatizált tesztek (sérülésmentesség, tengelyterhelés, lerakodás, optimalizáló, I/O).
// Futtatás: node --test tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const J = require('../jarmu.js');
const B = require('../biztonsag.js');
const L = require('../lerakodas.js');
const OP = require('../optimalizalo_profi.js');
const IO = require('../terv_io.js');
const O = require('../optimalizalo.js');

const STD = { type: 'Standard félpótkocsi', length: 1360, width: 245, height: 270, payloadKg: 24000 };
const JUMBO = { type: 'Jumbo – motorkocsi raktér', length: 770, width: 245, height: 300, payloadKg: 12000 };
const egy = (id, x, y, z, o = {}) => ({ id, length: 120, width: 80, height: 100, weight: 300, stackMode: 'szint', maxLayers: 3, maxLoadKg: 1000, rot: 0, placed: true, x, y, z, type: 'EUR-raklap', ...o });
const ell = (boxes, t = STD, cfg = {}) => B.ellenoriz({ trailer: t, boxes }, cfg);
const kodok = (r) => r.hibak.map((h) => h.kod);
const fkodok = (r) => r.figyelmeztetesek.map((h) => h.kod);
const kozel = (a, b, pct = 1) => Math.abs(a - b) <= Math.abs(b) * pct / 100;

// --- 1. Törékenység --------------------------------------------------------------------------------------
test('1. nehéz doboz törékenyre → TOREKENY_HALMOZAS; az optimalizáló sem teszi oda', () => {
  const r = ell([egy(1, 0, 0, 0, { torekenyseg: 'torekeny', weight: 100 }), egy(2, 0, 0, 100, { weight: 400 })]);
  assert.ok(kodok(r).includes('TOREKENY_HALMOZAS'));
  const n = ell([egy(1, 0, 0, 0, { torekenyseg: 'nagyon_torekeny' }), egy(2, 0, 0, 100, { weight: 10, torekenyseg: 'nagyon_torekeny' })]);
  assert.ok(kodok(n).includes('TOREKENY_HALMOZAS'), 'nagyon törékenyre semmi');
  const ok = ell([egy(1, 0, 0, 0, { torekenyseg: 'torekeny', weight: 300 }), egy(2, 0, 0, 100, { weight: 100, torekenyseg: 'torekeny' })]);
  assert.ok(!kodok(ok).includes('TOREKENY_HALMOZAS'), 'ugyanolyan törékeny, könnyebb: megengedett');
  const units = [];
  for (let i = 1; i <= 6; i++) units.push(egy(i, 0, 0, 0, { placed: false, torekenyseg: 'torekeny', weight: 80, maxLoadKg: 500 }));
  for (let i = 7; i <= 12; i++) units.push(egy(i, 0, 0, 0, { placed: false, weight: 400, maxLoadKg: 800 }));
  const er = OP.optimalizal({ trailer: STD, boxes: units }, { mod: 'gyors', seed: 1 });
  for (const cel of ['A', 'B', 'C']) assert.ok(!er.tervek[cel].ellenorzes.hibak.some((h) => h.kod === 'TOREKENY_HALMOZAS'), cel);
});
test('nehéz a könnyűn és felületi nyomás', () => {
  assert.ok(kodok(ell([egy(1, 0, 0, 0, { weight: 200 }), egy(2, 0, 0, 100, { weight: 300 })])).includes('NEHEZ_KONNYUN'));
  assert.ok(!kodok(ell([egy(1, 0, 0, 0, { weight: 300 }), egy(2, 0, 0, 100, { weight: 300 })])).includes('NEHEZ_KONNYUN'));
  // Kis alapterületű nehéz egység nagy raklapon: a nyomás koncentrált.
  const r = ell([egy(1, 0, 0, 0, { length: 120, width: 100, weight: 900, maxLoadKg: 1000 }), egy(2, 0, 0, 100, { length: 40, width: 40, weight: 500 })]);
  assert.ok(kodok(r).includes('FELULETI_NYOMAS'));
  assert.ok(!kodok(r).includes('TERHELES'), 'a teljes terhelhetőség még nincs túllépve');
});

// --- 2. Tengelyterhelés ---------------------------------------------------------------------------------
test('2. minden rakomány a homlokfalnál → TENGELYTERHELES; értékek a kézi emelőszabállyal ±1%', () => {
  const r = ell([{ id: 1, length: 200, width: 245, height: 100, weight: 18000, stackMode: 'nem', maxLayers: 1, maxLoadKg: null, placed: true, x: 0, y: 0, z: 0, rot: 0 }]);
  assert.ok(kodok(r).includes('TENGELYTERHELES'));
  // Kézi számítás: x = 100 cm; királycsap 140, tengelycsoport 915 → királycsapra 18000·815/775 = 18 929 kg.
  const kc = 2800 + 18000 * (915 - 100) / (915 - 140);
  const elso = 5000 + kc * 60 / 375, hajto = 2400 + kc * 315 / 375;
  const tg = r.mutatok.tengely.tengelyek;
  assert.ok(kozel(tg.find((a) => a.kulcs === 'elso').osszKg, elso), 'első tengely');
  assert.ok(kozel(tg.find((a) => a.kulcs === 'hajto').osszKg, hajto), 'hajtott tengely');
  assert.ok(tg.find((a) => a.kulcs === 'elso').tul && tg.find((a) => a.kulcs === 'hajto').tul);
  assert.ok(kodok(r).includes('SULYPONT_HOSSZ'), 'a terhelési diagramon kívül');
});
test('terhelési diagram: egyenletes teljes terhelés megengedett, a diagram a tengelyszámítással konzisztens', () => {
  const P = J.profil(STD);
  assert.ok(J.diagramErtek(STD, 680, P) >= 24000);
  assert.ok(J.diagramErtek(STD, 100, P) < 18000);
  for (const x of [200, 400, 700, 1000]) {
    const max = J.diagramErtek(STD, x, P);
    const tg = J.tengelyek(STD, [{ kg: max, x }], P);
    assert.ok(tg.tengelyek.every((a) => a.osszKg <= a.maxKg + 1), `x=${x}: a diagramérték nem terhel túl`);
  }
});

// --- 3. Keresztirányú súlypont --------------------------------------------------------------------------
test('3. egy oldalra pakolt nehéz rakomány → SULYPONT_KERESZT', () => {
  const boxes = [];
  for (let i = 0; i < 8; i++) boxes.push(egy(i + 1, i * 120, 0, 0, { weight: 1200, stackMode: 'nem', maxLayers: 1 }));
  assert.ok(kodok(ell(boxes)).includes('SULYPONT_KERESZT'));
  const r = OP.optimalizal({ trailer: STD, boxes: boxes.map((b) => ({ ...b, placed: false })) }, { mod: 'gyors', seed: 3 });
  assert.ok(!r.tervek.A.ellenorzes.hibak.some((h) => h.kod === 'SULYPONT_KERESZT'), 'az optimalizáló kiegyenlíti');
});

// --- 4–5. Lerakodás ------------------------------------------------------------------------------------
test('4. 1. lerakó a homlokfalnál, 3. az ajtónál → LERAKO_SORREND; az optimalizáló megfordítja (0 átrakás)', () => {
  const r = ell([egy(1, 0, 0, 0, { stop: 1 }), egy(2, 120, 0, 0, { stop: 3 })]);
  assert.ok(kodok(r).includes('LERAKO_SORREND'));
  assert.equal(r.mutatok.atrakas, 1);
  const units = [];
  for (let i = 1; i <= 24; i++) units.push(egy(i, 0, 0, 0, { placed: false, stop: 1 + (i % 3) }));
  const er = OP.optimalizal({ trailer: STD, boxes: units }, { mod: 'gyors', seed: 5 });
  assert.equal(er.tervek.A.osszegzes.atrakas, 0);
  assert.ok(er.tervek.A.ellenorzes.ok, JSON.stringify(er.tervek.A.ellenorzes.hibak.slice(0, 3)));
});
test('5. oldalsó lerakodás: bal oldali kivétel szabad / elzárt', () => {
  const szabad = ell([egy(1, 0, 0, 0, { stop: 1, lerakoOldal: 'bal' }), egy(2, 0, 80, 0, { stop: 2 })]);
  assert.ok(!kodok(szabad).includes('LERAKO_SORREND'));
  const zart = ell([egy(1, 0, 80, 0, { stop: 1, lerakoOldal: 'bal' }), egy(2, 0, 0, 0, { stop: 2 })]);
  assert.ok(kodok(zart).includes('LERAKO_SORREND'));
  const doboz = ell([egy(1, 0, 0, 0, { stop: 1, lerakoOldal: 'bal' })], { type: 'Dobozos teherautó', length: 720, width: 245, height: 250, payloadKg: 7000 });
  assert.ok(kodok(doboz).includes('AJTO_MERET'), 'nem nyitható oldalú járműnél oldalról nem rakható le');
});
test('6. részleges lerakodás után a kormányzott tengely a minimum alá kerül → KORMANYZOTT_TENGELY', () => {
  const r = ell([
    { id: 1, length: 120, width: 80, height: 100, weight: 3000, stackMode: 'nem', maxLayers: 1, maxLoadKg: null, placed: true, x: 0, y: 0, z: 0, rot: 0, stop: 1, lerakoOldal: 'bal' },
    { id: 2, length: 60, width: 245, height: 100, weight: 9000, stackMode: 'nem', maxLayers: 1, maxLoadKg: null, placed: true, x: 710, y: 0, z: 0, rot: 0, stop: 2 },
  ], JUMBO);
  const h = r.hibak.filter((q) => q.kod === 'KORMANYZOTT_TENGELY');
  assert.equal(h.length, 1);
  assert.match(h[0].szoveg, /1\. lerakó után/);
  assert.ok(r.mutatok.tengely.kormanyzott.ok, 'indulásnál még rendben');
});
test('villairány: csak rövid oldalról felvehető raklap hosszirányban áll a hátsó ajtónál', () => {
  assert.ok(!kodok(ell([egy(1, 0, 0, 0, { kezeles: 'targonca', villairany: 'hossz', rot: 0 })])).includes('KEZELES_IRANY'));
  assert.ok(kodok(ell([egy(1, 0, 0, 0, { kezeles: 'targonca', villairany: 'hossz', rot: 1 })])).includes('KEZELES_IRANY'));
});
test('lerakodási sorrend topologikus, a rakodási sorrend a fordítottja; idő lerakónként', () => {
  const r = ell([egy(1, 0, 0, 0, { stop: 2 }), egy(2, 0, 0, 100, { stop: 1, weight: 200 }), egy(3, 120, 0, 0, { stop: 1 })]);
  const s = r.mutatok.lerakodas;
  assert.deepEqual(s.lerakodasiSorrend.slice(0, 2).sort(), [2, 3]);
  assert.equal(s.lerakodasiSorrend[2], 1);
  assert.deepEqual(s.rakodasiSorrend, s.lerakodasiSorrend.slice().reverse());
  assert.equal(s.stopok.length, 2);
  assert.ok(s.stopok.every((q) => q.idoS > 0));
});

// --- 7–9. Hézag, rögzítés, borulás -----------------------------------------------------------------------
test('7. 40 cm-es hézag menetirányban → HEZAG_MENETIRANY és kitöltési javaslat', () => {
  const r = ell([egy(1, 0, 0, 0), egy(2, 160, 0, 0)]);
  const f = r.figyelmeztetesek.find((q) => q.kod === 'HEZAG_MENETIRANY');
  assert.ok(f && /40 cm/.test(f.szoveg) && /légzsák/.test(f.szoveg));
});
test('8. rögzítési becslés = kézi EN 12195-1 számítás', () => {
  const r = ell([{ id: 1, length: 120, width: 245, height: 100, weight: 1000, stackMode: 'nem', maxLayers: 1, maxLoadKg: null, placed: true, x: 500, y: 0, z: 0, rot: 0 }]);
  const g = r.mutatok.rogzites, mu = 0.45, sinA = 100 / Math.hypot(100, 5), stf = 4000;
  const n = (F, fs) => Math.ceil(F / (2 * mu * sinA * stf) * fs);
  const elore = n(1000 * 9.81 * (0.8 - mu), 1.25), oldal = n(1000 * 9.81 * (0.5 - mu), 1.1), hatra = n(1000 * 9.81 * (0.5 - mu), 1.1);
  assert.equal(g.iranyok.find((i) => i.irany === 'előre').n, elore);
  assert.equal(g.iranyok.find((i) => i.irany === 'oldalra').n, oldal);
  assert.equal(g.iranyok.find((i) => i.irany === 'hátra').n, hatra);
  assert.equal(g.pantDb, Math.max(elore, oldal, hatra));
  // Csúszásgátlóval (μ = 0,6) oldal- és hátrairányban nem kell lekötés.
  const r2 = ell([{ id: 1, length: 120, width: 245, height: 100, weight: 1000, stackMode: 'nem', maxLayers: 1, maxLoadKg: null, placed: true, x: 0, y: 0, z: 0, rot: 0 }], { ...STD, profil: { csuszasgatlo: true } });
  assert.equal(r2.mutatok.rogzites.mu, 0.6);
  assert.equal(r2.mutatok.rogzites.iranyok.find((i) => i.irany === 'oldalra').n, 0);
});
test('9. magas, keskeny, önálló oszlop → BORULAS; egyik oldalon támasztva csak rögzítési teendő', () => {
  assert.ok(kodok(ell([egy(1, 500, 90, 0, { length: 80, width: 60, height: 200 })])).includes('BORULAS'));
  const r = ell([egy(1, 0, 0, 0, { length: 60, width: 120, height: 200 })]);
  assert.ok(!kodok(r).includes('BORULAS'));
  assert.ok(fkodok(r).includes('BORULAS_ROGZITES'));
});
test('10. ismeretlen tömegű egység → nem igazolt; rá semmi nem kerül (az optimalizáló sem tesz)', () => {
  const r = ell([egy(1, 0, 82, 0, { tomegIgazolt: false })]);
  assert.equal(r.nemIgazolt.length, 1);
  assert.equal(r.allapot, 'Nem ellenőrzött');
  assert.ok(kodok(ell([egy(1, 0, 0, 0, { tomegIgazolt: false }), egy(2, 0, 0, 100, { weight: 100 })])).includes('NEHEZ_KONNYUN'));
  const units = [egy(1, 0, 0, 0, { placed: false, tomegIgazolt: false }), egy(2, 0, 0, 0, { placed: false, weight: 50 })];
  const er = OP.optimalizal({ trailer: { ...STD, length: 120, width: 80 }, boxes: units }, { mod: 'gyors', seed: 2 });
  assert.equal(er.tervek.A.elhelyezett, 1, 'a második egység nem kerülhet a nem igazolt tömegűre');
});

// --- Alátámasztás, ajtó, tető, billentés --------------------------------------------------------------------
test('több egységen átívelő alátámasztás: 90% elég, törékenynél 100% kell, túllógás tilos', () => {
  const ket = [egy(1, 0, 0, 0, { width: 60 }), egy(2, 0, 60, 0, { width: 60 })];
  assert.ok(!kodok(ell([...ket, egy(3, 0, 0, 100, { width: 120, weight: 250 })])).includes('ALATAMASZTAS'));
  // 5 cm-es rés középen: 110/120 = 91,7% érintkezés
  const res = [egy(1, 0, 0, 0, { width: 60 }), egy(2, 0, 65, 0, { width: 60 })];
  assert.ok(!kodok(ell([...res, egy(3, 0, 0, 100, { width: 120, weight: 250 })])).includes('ALATAMASZTAS'));
  assert.ok(kodok(ell([...res, egy(3, 0, 0, 100, { width: 120, weight: 250, torekenyseg: 'torekeny' })])).includes('ALATAMASZTAS'));
  assert.ok(kodok(ell([...ket, egy(3, 0, 10, 100, { width: 120, weight: 250 })])).includes('ALATAMASZTAS'), 'túllógás');
  // A teher az érintkezési területek arányában oszlik meg.
  const r = ell([...ket, egy(3, 0, 0, 100, { width: 120, weight: 240 })]);
  assert.equal(Math.round(r.alap.terheles.get(1)), 120);
});
test('ajtóméret, tető alatti rés, „ez a vége felfelé”', () => {
  assert.ok(kodok(ell([egy(1, 0, 0, 0, { height: 268 })])).includes('AJTO_MERET'));
  assert.ok(kodok(ell([egy(1, 0, 0, 0, { height: 269 })])).includes('TETO_RES'));
  assert.ok(kodok(ell([egy(1, 0, 0, 0, { billentve: 'L', allo: true })])).includes('ALLO_FORDITVA'));
  assert.ok(!kodok(ell([egy(1, 0, 0, 0, { billentve: 'L', allo: false, billentheto: true })])).includes('ALLO_FORDITVA'));
});
test('billenthető egység: az optimalizáló dönthet, és az eredeti méreteket megőrzi', () => {
  const t = { ...STD, height: 120 };
  const u = { id: 1, length: 150, width: 60, height: 130, weight: 100, stackMode: 'nem', maxLayers: 1, maxLoadKg: null, placed: false, x: 0, y: 0, z: 0, rot: 0, allo: false, billentheto: true };
  const er = OP.optimalizal({ trailer: t, boxes: [u] }, { mod: 'gyors', seed: 1, cfg: { tetoResCm: 2 } });
  const b = er.tervek.A.boxes[0];
  assert.ok(b.placed && b.billentve && b.height <= 118);
  assert.deepEqual(b.eredeti, { length: 150, width: 60, height: 130 });
  const nem = OP.optimalizal({ trailer: t, boxes: [{ ...u, allo: true, billentheto: false }] }, { mod: 'gyors', seed: 1 });
  assert.equal(nem.tervek.A.elhelyezett, 0);
});

// --- Optimalizáló: tulajdonságalapú teszt, determinizmus ----------------------------------------------------
test('P4: 1000 véletlen (megoldható) esetben az A terv mindig teljes és kemény hiba nélküli', () => {
  const rnd = O.mulberry32(777);
  const tipusok = ['EUR-raklap', 'Doboz', 'Láda', 'Gitterbox', 'Hordó'];
  let hiba = 0;
  for (let k = 0; k < 1000; k++) {
    const n = 3 + Math.floor(rnd() * 10), boxes = [];
    const stopDb = 1 + Math.floor(rnd() * 3);
    for (let i = 1; i <= n; i++) {
      const l = 40 + Math.floor(rnd() * 90), w = 40 + Math.floor(rnd() * 70), h = 40 + Math.floor(rnd() * 110);
      const frag = rnd() < 0.2 ? 'torekeny' : 'nem';
      boxes.push({ id: i, length: l, width: w, height: h, weight: 20 + Math.floor(rnd() * 600), stackMode: rnd() < 0.5 ? 'szint' : 'nem', maxLayers: 2, maxLoadKg: rnd() < 0.8 ? 400 : null, placed: false, x: 0, y: 0, z: 0, rot: 0, torekenyseg: frag, stop: rnd() < 0.6 ? 1 + Math.floor(rnd() * stopDb) : null, type: tipusok[Math.floor(rnd() * tipusok.length)] });
    }
    const er = OP.optimalizal({ trailer: STD, boxes }, { mod: 'gyors', seed: k + 1, veletlenIter: 0 });
    const A = er.tervek.A;
    // Független újraellenőrzés: a kimenet állapota és a hibák egyeznek.
    const re = B.ellenoriz({ trailer: STD, boxes: A.boxes });
    assert.equal(re.hibak.length, A.ellenorzes.hibak.length);
    if (!A.teljes || re.hibak.length) { hiba++; if (hiba < 3) console.log('Eset', k, re.hibak.slice(0, 3), A.kimaradt.slice(0, 2)); }
  }
  assert.equal(hiba, 0);
});
test('determinizmus: azonos seed és bemenet → azonos eredmény', () => {
  const units = [];
  for (let i = 1; i <= 30; i++) units.push(egy(i, 0, 0, 0, { placed: false, weight: 100 + (i * 37) % 400, stop: 1 + (i % 3) }));
  const a = OP.optimalizal({ trailer: STD, boxes: units }, { mod: 'intelligens', seed: 9, idokorlatMs: 1e9, veletlenIter: 40 });
  const b = OP.optimalizal({ trailer: STD, boxes: units }, { mod: 'intelligens', seed: 9, idokorlatMs: 1e9, veletlenIter: 40 });
  assert.deepEqual(a.tervek.A.boxes.map((q) => [q.x, q.y, q.z, q.rot]), b.tervek.A.boxes.map((q) => [q.x, q.y, q.z, q.rot]));
});
test('ha nem fér be minden szabályosan: kimaradt egységek okkal és javaslatokkal, kemény szabály nem sérül', () => {
  const units = [];
  for (let i = 1; i <= 40; i++) units.push(egy(i, 0, 0, 0, { placed: false, weight: 700, stackMode: 'nem', maxLayers: 1, maxLoadKg: null }));
  const er = OP.optimalizal({ trailer: STD, boxes: units }, { mod: 'gyors', seed: 4 });
  const A = er.tervek.A;
  assert.ok(!A.teljes && A.kimaradt.length > 0);
  assert.ok(A.ellenorzes.ok, 'az elhelyezett rész szabályos');
  assert.ok(er.javaslatok.some((j) => /Második jármű/.test(j)));
});

// --- I/O ------------------------------------------------------------------------------------------------
test('V07 mentés/betöltés: járműprofil és V07 mezők megmaradnak; V06 fájl betölthető', () => {
  const terv = { nev: 'x', trailer: { ...STD, profil: { csuszasgatlo: true, oldalfal: 'XL', vontato: { elsoMaxKg: 8000 }, forras: 'kezi' } }, boxes: [egy(1, 0, 0, 0, { torekenyseg: 'torekeny', kezeles: 'targonca', villairany: 'hossz', lerakoOldal: 'bal', cimzett: 'Bolt Kft.', adrOsztaly: '3', maxNyomasKgM2: 2000, tomegIgazolt: false, allo: false, billentheto: true })] };
  const doc = IO.ment(terv);
  assert.equal(doc.version, 7);
  const v = IO.betolt(JSON.parse(JSON.stringify(doc))).terv;
  assert.equal(v.trailer.profil.oldalfal, 'XL');
  assert.equal(v.trailer.profil.vontato.elsoMaxKg, 8000);
  const b = v.boxes[0];
  for (const k of ['torekenyseg', 'kezeles', 'villairany', 'lerakoOldal', 'cimzett', 'adrOsztaly', 'maxNyomasKgM2']) assert.equal(b[k], terv.boxes[0][k], k);
  assert.equal(b.tomegIgazolt, false); assert.equal(b.allo, false); assert.equal(b.billentheto, true);
  assert.equal(J.profil(v.trailer).vontato.hajtoMaxKg, 11500, 'a profil hiányzó mezői a sablonból');
  const v6 = IO.betolt({ format: 'rakodastervezo-3d', version: 6, trailer: STD, boxes: [egy(1, 0, 0, 0)] });
  assert.equal(v6.forras, 'V06 terv');
  const v3 = IO.betolt({ format: 'rakodastervezo-3d', version: 3, boxes: [{ id: 1, length: 100, width: 80, height: 80, placed: false }] });
  assert.equal(v3.terv.boxes[0].tomegIgazolt, false, 'V03: a tömeg alapértelmezett, nem igazolt');
});
test('integrációs export 1.1.0: a régi mezők változatlanok, új biztonsági blokk, arazas null', () => {
  const terv = { nev: 'x', trailer: STD, boxes: [egy(1, 0, 0, 0, { stop: 1 }), egy(2, 120, 0, 0, { stop: 2 })] };
  const d = IO.integracioExport(terv, null, '2026-11-26T00:00:00Z', 240, B.ellenoriz(terv));
  assert.equal(d.schemaVersion, '1.1.0');
  assert.deepEqual(IO.integracioEllenoriz(d), []);
  assert.equal(d.arazas, null);
  assert.ok(d.biztonsag && d.biztonsag.tengelyterhelesek.length === 3);
  assert.equal(d.biztonsag.lerakodas.atrakasokSzama, 1);
});
test('teljesítmény: 300 egység teljes V07-ellenőrzése és gyors optimalizálása időkereten belül', () => {
  const units = [];
  for (let i = 1; i <= 300; i++) units.push({ id: i, length: 40 + (i * 7) % 40, width: 30 + (i * 11) % 30, height: 30 + (i * 13) % 40, weight: 10 + (i * 17) % 40, stackMode: 'szint', maxLayers: 4, maxLoadKg: 200, placed: false, x: 0, y: 0, z: 0, rot: 0, stop: 1 + (i % 4), type: 'Doboz' });
  const t0 = Date.now();
  const er = OP.optimalizal({ trailer: STD, boxes: units }, { mod: 'gyors', seed: 1 });
  const dt = Date.now() - t0;
  const t1 = Date.now(); B.ellenoriz({ trailer: STD, boxes: er.tervek.A.boxes }); const de = Date.now() - t1;
  console.log(`300 egység: gyors optimalizálás ${dt} ms, teljes ellenőrzés ${de} ms, A terv: ${er.tervek.A.elhelyezett}/300, ${er.tervek.A.ellenorzes.hibak.length} kemény hiba`);
  assert.ok(dt < 15000 && de < 3000);
});
