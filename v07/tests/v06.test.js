// Rakománytervező 3D V06 – automatizált tesztek. Futtatás: node --test tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const G = require('../geometria.js');
const E = require('../ellenorzo.js');
const SZ = require('../szabad_ter.js');
const MU = require('../mutatok.js');
const O = require('../optimalizalo.js');
const IO = require('../terv_io.js');

const STD = { type: 'Standard félpótkocsi', length: 1360, width: 245, height: 270, payloadKg: 24000 };
let nid = 1;
const ujId = () => { nid = 1; };
const tetel = (n, l, w, h, kg, extra = {}) => Array.from({ length: n }, () => ({ id: nid++, length: l, width: w, height: h, weight: kg, stackMode: 'nem', maxLayers: 1, maxLoadKg: null, rot: 0, placed: false, x: 0, y: 0, z: 0, ...extra }));
const opt = (boxes, mod = 'gyors', t = STD, beall = {}) => O.optimalizal({ trailer: t, boxes }, { mod, seed: 42, ...beall });
const egyseg = (id, x, y, z, extra = {}) => ({ id, length: 120, width: 80, height: 100, weight: 300, stackMode: 'szint', maxLayers: 3, maxLoadKg: 1000, rot: 0, placed: true, x, y, z, ...extra });
const ell = (boxes, t = STD) => E.ellenoriz({ trailer: t, boxes });
const kodok = (e) => e.hibak.map((h) => h.kod);

// --- Geometria --------------------------------------------------------------------------------------------
test('geometria: érintkezés nem ütközés, átfedés igen', () => {
  const a = { x0: 0, x1: 120, y0: 0, y1: 80, z0: 0, z1: 100 };
  assert.equal(G.atfed(a, { ...a, x0: 120, x1: 240 }), false);
  assert.equal(G.atfed(a, { ...a, z0: 100, z1: 200 }), false);
  assert.equal(G.atfed(a, { ...a, x0: 119, x1: 239 }), true);
});
test('geometria: forgatás a méreteket cseréli, a nem forgatható egység csak 0°', () => {
  assert.deepEqual(G.meretek({ length: 120, width: 80, height: 50 }, 1), { l: 80, w: 120, h: 50 });
  assert.deepEqual(G.orientaciok({ length: 120, width: 80, height: 50 }, STD), [0, 1]);
  assert.deepEqual(G.orientaciok({ length: 120, width: 80, height: 50, rotatable: false }, STD), [0]);
  assert.deepEqual(G.orientaciok({ length: 300, width: 260, height: 200 }, STD), []);
});
test('geometria: térbeli index ütközés és alátámasztás', () => {
  const ix = new G.TerIndex(50);
  ix.hozzaad(1, { x0: 0, x1: 120, y0: 0, y1: 80, z0: 0, z1: 100 });
  assert.ok(ix.utkozik({ x0: 100, x1: 220, y0: 0, y1: 80, z0: 0, z1: 100 }));
  assert.equal(ix.utkozik({ x0: 120, x1: 240, y0: 0, y1: 80, z0: 0, z1: 100 }), null);
  assert.ok(ix.alatamaszto({ x0: 0, x1: 120, y0: 0, y1: 80, z0: 100, z1: 200 }));
  assert.equal(ix.alatamaszto({ x0: 10, x1: 130, y0: 0, y1: 80, z0: 100, z1: 200 }), null);
});
test('geometria: rács- és mágneses illesztés (1/5/10 cm, falak, szomszéd)', () => {
  assert.deepEqual(G.illeszt(13, 7, { l: 120, w: 80 }, STD, [], { lepes: 5, magnes: false }), { x: 15, y: 5 });
  assert.deepEqual(G.illeszt(13, 7, { l: 120, w: 80 }, STD, [], { lepes: 10, magnes: false }), { x: 10, y: 10 });
  assert.deepEqual(G.illeszt(4, 160, { l: 120, w: 80 }, STD, [], { lepes: 1, magnes: true, kuszob: 10 }), { x: 0, y: 165 });
  assert.deepEqual(G.illeszt(126, 3, { l: 120, w: 80 }, STD, [{ x0: 0, x1: 120, y0: 0, y1: 80 }], { lepes: 1, magnes: true, kuszob: 10 }), { x: 120, y: 0 });
  assert.deepEqual(G.illeszt(126, 3, { l: 120, w: 80 }, STD, [], { lepes: 1, magnes: false }), { x: 126, y: 3 });
});

// --- Ellenőrzés és halmozás ------------------------------------------------------------------------------------
test('8. teszt (logika): részben egymásba tolt egységek → UTKOZES, a kézi ellenőrzés blokkol', () => {
  const k = E.keziEllenoriz({ trailer: STD, boxes: [egyseg(1, 0, 0, 0), egyseg(2, 60, 40, 0)] });
  assert.equal(k.ok, false);
  assert.ok(k.blokkolo.some((h) => h.kod === 'UTKOZES'));
  assert.equal(E.keziEllenoriz({ trailer: STD, boxes: [egyseg(1, 0, 0, 0), egyseg(2, 120, 0, 0)] }).ok, true);
});
test('határok: padló, oldalfal, tető, ajtósík', () => {
  for (const b of [egyseg(1, -1, 0, 0), egyseg(1, 0, 166, 0), egyseg(1, 1241, 0, 0), egyseg(1, 0, 0, 171)])
    assert.ok(kodok(ell([b])).includes('HATAR') || kodok(ell([b])).includes('ALATAMASZTAS'));
  assert.equal(ell([egyseg(1, 1240, 165, 0)]).ok, true);
});
test('5. teszt (kézi): „semmi a tetejére” egységre nem tehető semmi', () => {
  const e = ell([egyseg(1, 0, 0, 0, { stackMode: 'semmi' }), egyseg(2, 0, 0, 100)]);
  assert.ok(kodok(e).includes('NEM_HALMOZHATO'));
});
test('„semmi a tetejére” egység állhat halmozható egységen', () => {
  assert.equal(ell([egyseg(1, 0, 0, 0), egyseg(2, 0, 0, 100, { stackMode: 'semmi' })]).ok, true);
});
test('„nem halmozható” egység nem állhat más egységen', () => {
  assert.ok(kodok(ell([egyseg(1, 0, 0, 0), egyseg(2, 0, 0, 100, { stackMode: 'nem' })])).includes('FELSO_TILTOTT'));
});
test('oszlop szintkorlátja: a legszigorúbb tag dönt', () => {
  const e = ell([egyseg(1, 0, 0, 0, { height: 60 }), egyseg(2, 0, 0, 60, { height: 60, maxLayers: 2 }), egyseg(3, 0, 0, 120, { height: 60 })]);
  assert.ok(kodok(e).includes('OSZLOP_SZINT'));
  assert.equal(ell([egyseg(1, 0, 0, 0, { height: 60 }), egyseg(2, 0, 0, 60, { height: 60 }), egyseg(3, 0, 0, 120, { height: 60 })]).ok, true);
});
test('felső terhelhetőség és ismeretlen terhelhetőség', () => {
  assert.ok(kodok(ell([egyseg(1, 0, 0, 0, { maxLoadKg: 200 }), egyseg(2, 0, 0, 100)])).includes('TERHELES'));
  const e = ell([egyseg(1, 0, 0, 0, { maxLoadKg: null }), egyseg(2, 0, 0, 100)]);
  assert.equal(e.ok, true);
  assert.equal(e.allapot, E.ALLAPOT.NEM_ELLENORZOTT);
});
test('nem forgatható egység elforgatva → hiba', () => {
  assert.ok(kodok(ell([egyseg(1, 0, 0, 0, { rotatable: false, rot: 1 })])).includes('FORGATAS_TILTOTT'));
});
test('lerakodási sorrend: később lerakott egység nem zárhatja el az ajtót', () => {
  const e = E.ellenoriz({ trailer: STD, boxes: [egyseg(1, 0, 0, 0, { stop: 1 }), egyseg(2, 120, 0, 0, { stop: 2 })] }, { sorrend: true });
  assert.ok(kodok(e).includes('LERAKO_SORREND'));
  assert.equal(E.ellenoriz({ trailer: STD, boxes: [egyseg(1, 0, 0, 0, { stop: 2 }), egyseg(2, 120, 0, 0, { stop: 1 })] }, { sorrend: true }).ok, true);
});

// --- Kötelező tesztesetek --------------------------------------------------------------------------------
test('1. teszt: 10 db 120×80×100, 300 kg, nem halmozható', () => {
  ujId(); const r = opt(tetel(10, 120, 80, 100, 300)), A = r.tervek.A;
  const m = MU.szamol(A);
  assert.equal(m.osszTomegKg, 3000);
  assert.equal(Number(m.elmeleti.halmozasNelkul.toFixed(6)), 4);
  assert.equal(A.teljes, true); assert.equal(A.ellenorzes.ok, true);
  assert.ok(A.fizikaiHosszCm <= 400, `fizikai ${A.fizikaiHosszCm}`);
  assert.ok(!A.ellenorzes.hibak.some((h) => h.kod === 'UTKOZES'));
});
test('2. teszt: 12 db 120×80×80, 250 kg, max. 3 szint, 600 kg', () => {
  ujId(); const r = opt(tetel(12, 120, 80, 80, 250, { stackMode: 'szint', maxLayers: 3, maxLoadKg: 600 })), A = r.tervek.A;
  const m = MU.szamol(A);
  assert.equal(m.osszTomegKg, 3000);
  assert.equal(A.teljes, true); assert.equal(A.ellenorzes.ok, true);
  assert.equal(Number(m.elmeleti.halmozassalKorrigalt.toFixed(6)), 1.6);
  const padlon = A.boxes.filter((b) => b.z === 0);
  assert.equal(padlon.length, 4, 'négy oszlop');
  assert.equal(Math.max(...A.boxes.map((b) => b.z + b.height)), 240);
  const e = E.ellenoriz(A);
  for (const b of padlon) assert.equal(e.terheles.get(b.id), 500);
  assert.ok(A.fizikaiHosszCm <= 160);
  // Kiegészítő: 200 kg terhelhetőségnél nem lehet 3 szint.
  ujId(); const r2 = opt(tetel(12, 120, 80, 80, 250, { stackMode: 'szint', maxLayers: 3, maxLoadKg: 200 }));
  assert.equal(Math.max(...r2.tervek.A.boxes.map((b) => b.z)), 0);
  ujId(); const r3 = opt(tetel(12, 120, 80, 80, 250, { stackMode: 'szint', maxLayers: 3, maxLoadKg: 300 }));
  assert.equal(Math.max(...r3.tervek.A.boxes.map((b) => b.z + b.height)), 160, '300 kg: legfeljebb 2 szint');
});
test('3. teszt: vegyes rakomány, eltérő halmozási szabályok', () => {
  ujId();
  const boxes = [...tetel(6, 120, 80, 100, 350, { stackMode: 'szint', maxLayers: 2, maxLoadKg: 400 }), ...tetel(4, 100, 100, 120, 450), ...tetel(3, 150, 70, 80, 200, { stackMode: 'semmi' })];
  const r = opt(boxes, 'intelligens'), A = r.tervek.A;
  assert.equal(MU.szamol(A).osszTomegKg, 4500);
  assert.equal(A.teljes, true); assert.equal(A.ellenorzes.ok, true);
  assert.ok(A.boxes.some((b) => b.rot === 1), 'forgatott elhelyezés is előfordul');
  assert.ok(A.boxes.filter((b) => b.z > 0).every((b) => b.length === 120), 'csak a raklapok halmozva');
  assert.ok(A.fizikaiHosszCm < 600);
});
test('4. teszt: 300×260×200 nem helyezhető el 245 cm szélességben', () => {
  ujId(); const r = opt(tetel(1, 300, 260, 200, 1000));
  assert.equal(r.tervek.A.teljes, false);
  assert.equal(r.tervek.A.kimaradt[0].kod, 'NEM_FER_BE');
  assert.match(r.tervek.A.allapotSzoveg, /RÉSZLEGES/);
});
test('5. teszt: „semmi a tetejére” – az optimalizáló sem tesz rá semmit', () => {
  ujId(); const r = opt(tetel(4, 120, 80, 100, 400, { stackMode: 'semmi' }), 'intelligens');
  assert.ok(r.tervek.A.boxes.every((b) => b.z === 0));
  assert.equal(r.tervek.A.ellenorzes.ok, true);
});
test('6. teszt: 4 db 120×100×100 – 90°-os forgatással 200 cm', () => {
  ujId(); const r = opt(tetel(4, 120, 100, 100, 300));
  assert.equal(r.tervek.A.fizikaiHosszCm, 200);
  assert.ok(r.tervek.A.boxes.every((b) => b.rot === 1));
});
test('7. teszt: 30 × 1000 kg, 24 000 kg hasznos teher → nem teljesíthető, részleges', () => {
  ujId(); const r = opt(tetel(30, 120, 80, 100, 1000)), A = r.tervek.A;
  assert.equal(A.teljes, false);
  assert.ok(A.elhelyezett <= 24);
  assert.equal(A.kimaradt.length, 30 - A.elhelyezett);
  assert.ok(A.kimaradt.every((k) => k.kod === 'HASZNOS_TEHER_TULLEPES'));
  assert.ok(r.figyelmeztetesek.some((f) => /nem teljesíthető/.test(f)));
  assert.notEqual(A.allapot, E.ALLAPOT.ERVENYES);
});
test('C terv: csak lerakóhelyekkel készül, és betartja a sorrendet', () => {
  ujId(); const r = opt(tetel(6, 120, 80, 100, 300));
  assert.equal(r.tervek.C.generalva, false);
  ujId(); const b = [...tetel(4, 120, 80, 100, 300, { stop: 1 }), ...tetel(4, 120, 80, 100, 300, { stop: 2 })];
  const r2 = opt(b, 'intelligens'), C = r2.tervek.C;
  assert.equal(C.generalva, true); assert.equal(C.teljes, true); assert.equal(C.ellenorzes.ok, true);
  const maxX2 = Math.max(...C.boxes.filter((q) => q.stop === 2).map((q) => q.x));
  const minX1 = Math.min(...C.boxes.filter((q) => q.stop === 1).map((q) => q.x));
  assert.ok(minX1 >= maxX2, 'az 1. lerakó egységei az ajtóhoz közelebb');
});
test('optimalizáló: reprodukálható azonos seeddel, és megszakítható', () => {
  ujId(); const b = [...tetel(10, 120, 80, 100, 300, { stackMode: 'szint', maxLayers: 2, maxLoadKg: 500 }), ...tetel(8, 100, 60, 90, 120)];
  const a1 = O.optimalizal({ trailer: STD, boxes: b }, { mod: 'intelligens', seed: 7, veletlenIter: 40, idokorlatMs: 60000 });
  const a2 = O.optimalizal({ trailer: STD, boxes: b }, { mod: 'intelligens', seed: 7, veletlenIter: 40, idokorlatMs: 60000 });
  assert.deepEqual(a1.tervek.A.boxes, a2.tervek.A.boxes);
  const k = O.keresesInditas({ trailer: STD, boxes: b }, { mod: 'maximalis', seed: 1 });
  k.lepes(5); k.megszakit();
  const e = k.eredmeny();
  assert.equal(e.megszakitva, true);
  assert.ok(e.tervek.A && e.tervek.A.ellenorzes.ok);
});
test('optimalizáló: ismeretlen felső terhelhetőségre nem halmoz automatikusan', () => {
  ujId(); const r = opt(tetel(6, 120, 80, 80, 100, { stackMode: 'szint', maxLayers: 3, maxLoadKg: null }));
  assert.ok(r.tervek.A.boxes.every((b) => b.z === 0));
});
test('optimalizáló: véletlen vegyes rakományoknál minden terv érvényes', () => {
  const rnd = O.mulberry32(99);
  for (let k = 0; k < 15; k++) {
    ujId(); const b = [];
    for (let i = 0; i < 4; i++) {
      const modok = ['nem', 'semmi', 'szint'], m = modok[Math.floor(rnd() * 3)];
      b.push(...tetel(1 + Math.floor(rnd() * 8), 40 + Math.floor(rnd() * 120), 40 + Math.floor(rnd() * 100), 30 + Math.floor(rnd() * 120), 50 + Math.floor(rnd() * 400),
        { stackMode: m, maxLayers: 2 + Math.floor(rnd() * 3), maxLoadKg: rnd() < 0.2 ? null : 200 + Math.floor(rnd() * 1000), rotatable: rnd() < 0.8 }));
    }
    const r = opt(b, 'intelligens', STD, { veletlenIter: 20 });
    for (const c of ['A', 'B']) assert.equal(r.tervek[c].ellenorzes.ok, true, `${k}. eset ${c}: ${JSON.stringify(r.tervek[c].ellenorzes.hibak.slice(0, 2))}`);
  }
});

// --- LDM és szabad tér -------------------------------------------------------------------------------------
test('LDM: referenciaszélesség konfigurálható, független a belső szélességtől', () => {
  ujId(); const b = tetel(10, 120, 80, 100, 300);
  assert.equal(MU.elmeleti(STD, b).halmozasNelkul.toFixed(6), '4.000000');
  assert.equal(MU.elmeleti(STD, b, 245).halmozasNelkul.toFixed(6), (9.6 / 2.45).toFixed(6));
});
test('szabad tér: átfedésmentes felbontás, pontos szabad térfogat', () => {
  const boxes = [egyseg(1, 0, 0, 0), egyseg(2, 0, 80, 0), egyseg(3, 0, 0, 100)];
  const s = SZ.elemez(STD, boxes, { max: 30 });
  assert.equal(s.szabadTerfogatCm3, 1360 * 245 * 270 - 3 * 120 * 80 * 100);
  for (let i = 0; i < s.terek.length; i++) for (let j = i + 1; j < s.terek.length; j++) assert.equal(G.atfed(s.terek[i], s.terek[j]), false);
  for (const t of s.terek) for (const b of boxes) assert.equal(G.atfed(t, G.doboz(b)), false);
  assert.ok(s.felsoroltTerfogatCm3 <= s.szabadTerfogatCm3);
  assert.equal(s.hatsoSzabadHosszCm, 1240);
  assert.equal(s.terek[0].hosszCm, 1240);
});
test('szabad tér: javaslat a befogadható tételekre', () => {
  const tet = [{ length: 120, width: 80, height: 100, stackMode: 'szint' }, { length: 300, width: 200, height: 250, stackMode: 'nem' }];
  assert.equal(SZ.javaslat({ x0: 0, x1: 100, y0: 0, y1: 130, z0: 0, z1: 120 }, tet).length, 1);
});

// --- Mentés, betöltés, integráció -------------------------------------------------------------------------
test('9. teszt: összetett terv mentése és visszatöltése bitre azonos', () => {
  ujId();
  const b = [...tetel(6, 120, 80, 100, 350.5, { stackMode: 'szint', maxLayers: 2, maxLoadKg: 400, color: '#123456', label: 'EUR', itemId: 'T01', stop: 1 }),
    ...tetel(4, 100, 100, 120, 450, { color: '#abcdef', rotatable: false, name: 'Gép' }), ...tetel(3, 150, 70, 80, 200, { stackMode: 'semmi', maxLoadKg: null })];
  const A = opt(b, 'intelligens').tervek.A;
  const terv = { nev: 'Összetett', trailer: STD, elszamolas: { kgPerLdm: 1750, kerekites: 'Nincs kerekítés', szabaly: 'maximum' }, beallitasok: { refSzelessegCm: 240 }, boxes: A.boxes };
  const fajl = JSON.parse(JSON.stringify(IO.ment(terv)));
  const vissza = IO.betolt(fajl).terv;
  const kulcsok = ['id', 'x', 'y', 'z', 'rot', 'placed', 'length', 'width', 'height', 'weight', 'color', 'stackMode', 'maxLayers', 'maxLoadKg', 'rotatable', 'stop', 'label', 'name', 'itemId'];
  for (let i = 0; i < A.boxes.length; i++) for (const k of kulcsok) assert.deepEqual(vissza.boxes[i][k], IO.ment(terv).boxes[i][k], `${A.boxes[i].id}.${k}`);
  assert.deepEqual(vissza.trailer, STD);
  assert.deepEqual(MU.szamol(vissza).fizikai, MU.szamol(terv).fizikai);
});
test('V05-kompatibilitás: a V05 mintatervek és tervgyűjtemények betölthetők', () => {
  const dir = path.join(__dirname, '..', 'mintatervek');
  const v4 = IO.betolt(JSON.parse(fs.readFileSync(path.join(dir, 'mintaterv_3_reteg.json'), 'utf8')));
  assert.equal(v4.tipus, 'terv');
  assert.equal(E.keziEllenoriz(v4.terv).ok, true, JSON.stringify(E.keziEllenoriz(v4.terv).blokkolo));
  const g = IO.betolt(JSON.parse(fs.readFileSync(path.join(dir, 'mintatervek_3_valtozat.json'), 'utf8')));
  assert.equal(g.tervek.length, 3);
  assert.ok(g.tervek.every((t) => t.boxes.every((b) => b.stackMode === (b.stackable ? 'szint' : 'semmi'))));
});
test('V05-kompatibilitás: V05 egyedi mentés (középre vonatkoztatott cm) pontos visszaalakítása páratlan szélességnél', () => {
  // A V05 mentése: Math.round((cm/100 − W/200) × 100), lebegőpontos kerekítéssel.
  const v05x = (cm, L) => Math.round((cm / 100 - L / 200) * 100);
  const boxes = [egyseg(1, 0, 0, 0), egyseg(2, 0, 165, 0), egyseg(3, 120, 85, 0), egyseg(4, 0, 0, 100)];
  const doc = { format: 'rakodastervezo-3d', version: 5, units: 'cm', trailer: STD, billing: { kgPerLdm: 1750, szabaly: 'maximum', kerekites: 'Nincs kerekítés' },
    boxes: boxes.map((b) => ({ ...b, stackable: true, x: v05x(b.x, 1360), y: v05x(b.y, 245), z: b.z })) };
  const t = IO.betolt(doc).terv;
  assert.equal(E.keziEllenoriz(t).ok, true, JSON.stringify(E.keziEllenoriz(t).blokkolo));
  for (const b of t.boxes) { const o = boxes.find((q) => q.id === b.id); assert.ok(Math.abs(b.y - o.y) <= 1 && b.x === o.x); }
});
test('integráció: export séma, ár nélkül, visszaimportálható', () => {
  ujId(); const A = opt(tetel(12, 120, 80, 80, 250, { stackMode: 'szint', maxLayers: 3, maxLoadKg: 600, itemId: 'T01' })).tervek.A;
  const d = JSON.parse(JSON.stringify(IO.integracioExport({ ...A, nev: 'Teszt' }, { mod: 'gyors', cel: 'A', seed: 42, iteracio: 7, idoMs: 3 })));
  assert.deepEqual(IO.integracioEllenoriz(d), []);
  assert.equal(d.arazas, null);
  assert.equal(d.tetelek.length, 1); assert.equal(d.tetelek[0].darabszam, 12); assert.equal(d.tetelek[0].ossztomegKg, 3000);
  assert.equal(d.mutatok.elmeletiLdmHalmozassal, 1.6);
  assert.equal(d.ervenyesseg.ervenyes, true);
  const vissza = IO.betolt(d).terv;
  assert.equal(vissza.boxes.length, 12);
});
test('betöltés: hibás fájlok elutasítva', () => {
  assert.throws(() => IO.betolt({ format: 'xyz' }));
  assert.throws(() => IO.betolt({ format: 'rakodastervezo-3d', version: 6, trailer: STD, boxes: [{ id: 1, length: 0, width: 1, height: 1, weight: 1 }] }));
  assert.throws(() => IO.betolt({ format: 'rakodastervezo-3d', version: 6, trailer: STD, boxes: [{ id: 1, length: 10, width: 10, height: 10, weight: 1 }, { id: 1, length: 10, width: 10, height: 10, weight: 1 }] }));
});
