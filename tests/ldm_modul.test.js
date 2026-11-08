// Futtatás: node --test tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../ldm_modul.js');

const T = (o = {}) => ({ type: 'Normál', length: 1360, width: 245, height: 270, payloadKg: 24000, ...o });
let seq = 0;
const box = (o = {}) => ({ id: ++seq, label: '', type: 'Raklap', color: '#888888', length: 120, width: 80, height: 100, weight: 300,
  stackable: true, maxLayers: 3, maxLoadKg: 1000, rot: 0, placed: true, x: 0, y: 0, z: 0, ...o });
const kodok = (r) => r.hibak.map((h) => h.kod);
const fkodok = (r) => r.figyelmeztetesek.map((h) => h.kod);
const near = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

// ---------------------------------------------------------------- Elméleti LDM
test('elméleti LDM: halmozás nélkül = Σ hossz × szélesség ÷ (245 × 100)', () => {
  const b = [box(), box({ y: 80 }), box({ length: 100, width: 120, y: 160 })];
  const e = L.elmeleti(T(), b);
  near(e.halmozasNelkul, (2 * 120 * 80 + 100 * 120) / 24500);
});
test('elméleti LDM: forgatás nem változtat a területalapú értéken', () => {
  const a = L.elmeleti(T(), [box({ rot: 0 })]).halmozasNelkul;
  const r = L.elmeleti(T(), [box({ rot: 1 })]).halmozasNelkul;
  near(a, r);
});
test('elméleti LDM: adatokból halmozva – rétegszám, belmagasság és ráterhelés korlátja', () => {
  // 6 db 120×80×100, max 3 réteg, de 270 cm belmagasság → 2 szint; 3 hely
  const b = Array.from({ length: 6 }, () => box({ placed: false }));
  const e = L.elmeleti(T(), b);
  assert.equal(e.csoportok[0].szint, 2);
  assert.equal(e.csoportok[0].helyek, 3);
  near(e.adatokbolHalmozva, 3 * 9600 / 24500);
  // ráterhelés: 300 kg egység, 300 kg engedett → 2 szint; 0 kg → 1 szint
  near(L.elmeleti(T(), Array.from({ length: 4 }, () => box({ height: 50, maxLoadKg: 300 }))).adatokbolHalmozva, 2 * 9600 / 24500);
  near(L.elmeleti(T(), Array.from({ length: 4 }, () => box({ height: 50, maxLoadKg: 0 }))).adatokbolHalmozva, 4 * 9600 / 24500);
});
test('elméleti LDM: nem halmozható és ismeretlen ráterhelés → nincs halmozás feltételezve', () => {
  const nem = L.elmeleti(T(), Array.from({ length: 4 }, () => box({ stackable: false, height: 50 })));
  near(nem.adatokbolHalmozva, nem.halmozasNelkul);
  const ism = L.elmeleti(T(), Array.from({ length: 4 }, () => box({ maxLoadKg: null, height: 50 })));
  near(ism.adatokbolHalmozva, ism.halmozasNelkul);
  assert.ok(ism.feltetelezesek.some((f) => f.includes('ismeretlen')));
});
test('elméleti LDM: terv szerinti halmozás csak a padlón állókat számolja', () => {
  const b = [box(), box({ z: 100 })];
  const e = L.elmeleti(T(), b);
  near(e.tervSzerintiHalmozas, 9600 / 24500);
  near(e.halmozasNelkul, 2 * 9600 / 24500);
});
test('elméleti LDM a referenciaszélességgel számol (szűkített pótkocsi)', () => {
  near(L.elmeleti(T({ width: 240 }), [box()]).halmozasNelkul, 9600 / 24000);
});

// ---------------------------------------------------------------- Fizikai LDM
test('fizikai LDM: egymás melletti dobozok NEM összegződnek', () => {
  const b = [box(), box({ y: 80 }), box({ y: 160 })];
  const f = L.fizikai(T(), b);
  assert.equal(f.hasznaltHosszCm, 120);
  near(f.ldm, 1.2);
  assert.equal(f.dobozHosszOsszegCm, 360); // a hossz-összeg más mutató
});
test('fizikai LDM: forgatott raklapok – 80 cm hosszirányú lefoglalás', () => {
  const b = [box({ rot: 1 }), box({ rot: 1, y: 120 })];
  assert.equal(L.ellenoriz(T(), b).ok, true);
  near(L.fizikai(T(), b).ldm, 0.8);
});
test('fizikai LDM: halmozott doboz nem növeli a hosszt, és nem duplázza az alapterületet', () => {
  const b = [box(), box({ z: 100, length: 100, width: 60 })];
  const f = L.fizikai(T(), b);
  near(f.ldm, 1.2);
  assert.equal(f.alapteruletCm2, 9600);
});
test('fizikai LDM: homlokfal-hézag és közbenső hézag beszámít és figyelmeztet', () => {
  const b = [box({ x: 100 }), box({ x: 400 })];
  const f = L.fizikai(T(), b);
  near(f.ldm, 5.2);
  assert.equal(f.nettoFoglaltHosszCm, 240);
  const e = L.ellenoriz(T(), b);
  assert.ok(fkodok(e).includes('ELSO_HEZAG'));
  assert.ok(fkodok(e).includes('KERESZT_HEZAG'));
});
test('fizikai LDM: 33 EUR raklap – fizikai 13,20 ≠ elméleti 12,93 ≠ hosszösszeg 39,6', () => {
  const b = [];
  for (let r = 0; r < 11; r++) for (let c = 0; c < 3; c++) b.push(box({ x: r * 120, y: c * 80, weight: 500 }));
  const a = L.elemzes({ trailer: T(), boxes: b });
  assert.equal(a.megfelel, true);
  near(a.fizikai.ldm, 13.2);
  near(a.elmeleti.halmozasNelkul, 33 * 9600 / 24500);
  assert.equal(a.fizikai.dobozHosszOsszegCm, 3960);
  assert.ok(a.elteresek.some((s) => s.includes('≠')));
  near(a.fizikai.szabadTeruletOsszesCm2, 1360 * 245 - 33 * 9600, 0);
  near(a.fizikai.szabadTeruletSavbanCm2, 1320 * 245 - 33 * 9600, 0);
});
test('fizikai LDM: vegyes méretek', () => {
  const b = [box({ length: 120, width: 100 }), box({ length: 80, width: 60, y: 100 }), box({ length: 200, width: 85, y: 160 })];
  const a = L.elemzes({ trailer: T(), boxes: b });
  assert.equal(a.megfelel, true);
  near(a.fizikai.ldm, 2.0);
  near(a.elmeleti.halmozasNelkul, (12000 + 4800 + 17000) / 24500);
});
test('üres terv: 0 LDM, figyelmeztetés', () => {
  const a = L.elemzes({ trailer: T(), boxes: [] });
  assert.equal(a.fizikai.ldm, 0);
  assert.equal(a.ajanlatraAlkalmas, false);
});

// ---------------------------------------------------------------- Geometria, halmozás
test('ütközés észlelése', () => {
  assert.ok(kodok(L.ellenoriz(T(), [box(), box({ x: 119 })])).includes('UTKOZES'));
  assert.equal(L.ellenoriz(T(), [box(), box({ x: 120 })]).ok, true); // érintkezés nem ütközés
});
test('geometriai határok: hossz, szélesség, magasság, negatív pozíció', () => {
  assert.ok(kodok(L.ellenoriz(T(), [box({ x: 1241 })])).includes('HATAR'));
  assert.equal(L.ellenoriz(T(), [box({ x: 1240 })]).ok, true);
  assert.ok(kodok(L.ellenoriz(T(), [box({ y: 166 })])).includes('HATAR'));
  assert.ok(kodok(L.ellenoriz(T(), [box({ rot: 1, y: 126 })])).includes('HATAR')); // forgatva 120 széles
  assert.ok(kodok(L.ellenoriz(T(), [box(), box({ z: 100, height: 171 })])).includes('HATAR'));
  assert.ok(kodok(L.ellenoriz(T(), [box({ x: -1 })])).includes('HATAR'));
});
test('alátámasztás: lebegő és részben alátámasztott doboz hibás', () => {
  assert.ok(kodok(L.ellenoriz(T(), [box({ z: 10 })])).includes('ALATAMASZTAS'));
  assert.ok(kodok(L.ellenoriz(T(), [box(), box({ z: 100, x: 10 })])).includes('ALATAMASZTAS'));
});
test('nem halmozható alsó egység', () => {
  assert.ok(kodok(L.ellenoriz(T(), [box({ stackable: false }), box({ z: 100 })])).includes('NEM_HALMOZHATO'));
});
test('rétegszám-korlát', () => {
  const b = [box({ height: 50, maxLayers: 2 }), box({ height: 50, z: 50 }), box({ height: 50, z: 100 })];
  assert.ok(kodok(L.ellenoriz(T(), b)).includes('RETEG'));
  b[0].maxLayers = 3;
  assert.equal(L.ellenoriz(T(), b).ok, true);
});
test('ráterhelés: túllépés hiba, ismeretlen érték figyelmeztetés', () => {
  assert.ok(kodok(L.ellenoriz(T(), [box({ maxLoadKg: 299 }), box({ z: 100 })])).includes('TERHELES'));
  const e = L.ellenoriz(T(), [box({ maxLoadKg: null }), box({ z: 100 })]);
  assert.equal(e.ok, true);
  assert.ok(fkodok(e).includes('NEM_IGAZOLT_TERHELES'));
});
test('teherbírás-túllépés', () => {
  assert.ok(kodok(L.ellenoriz(T({ payloadKg: 500 }), [box(), box({ x: 120 })])).includes('TEHERBIRAS'));
});
test('nem egész cm adat elutasítva', () => {
  assert.ok(kodok(L.ellenoriz(T(), [box({ length: 120.5 })])).includes('ADAT'));
  assert.ok(kodok(L.ellenoriz(T(), [box({ x: 0.4 })])).includes('ADAT'));
});
test('több hibát is összegyűjt', () => {
  const e = L.ellenoriz(T(), [box(), box({ x: 10 }), box({ x: 1300 })]);
  assert.ok(kodok(e).includes('UTKOZES') && kodok(e).includes('HATAR'));
});
test('unionArea pontos', () => {
  assert.equal(L.unionArea([{ x0: 0, x1: 10, y0: 0, y1: 10 }, { x0: 5, x1: 15, y0: 5, y1: 15 }]), 175);
});

// ---------------------------------------------------------------- Díjszámítási LDM (FuvarDíj 4.0 tükör)
test('kerekítés: lebegőpontos zaj nem kerekít felfelé', () => {
  assert.equal(L.kerekit(2.0000000001, 'Felfelé 0,1 LDM-re'), 2.0);
  assert.equal(L.kerekit(2.01, 'Felfelé 0,1 LDM-re'), 2.1);
  assert.equal(L.kerekit(2.25, 'Matematikai kerekítés 0,1 LDM-re'), 2.3);
  assert.equal(L.kerekit(2.24, 'Matematikai kerekítés 0,1 LDM-re'), 2.2);
  assert.equal(L.kerekit(1.26, 'Felfelé 0,25 LDM-re'), 1.5);
  assert.equal(L.kerekit(1.234, 'Nincs kerekítés'), 1.234);
  assert.throws(() => L.kerekit(1, 'Kitalált'));
});
test('elszámolás: maximum / fizikai / tömeg szabály', () => {
  const m = L.elszamolas(1.2, 4000, { kgPerLdm: 1750, szabaly: 'maximum', kerekites: 'Felfelé 0,1 LDM-re' });
  near(m.tomegalapuLdm, 4000 / 1750);
  assert.equal(m.elszamolasiLdm, 2.3);
  assert.equal(m.meghatarozo, 'tömeg');
  assert.equal(L.elszamolas(1.2, 4000, { szabaly: 'fizikai' }).elszamolasiLdm, 1.2);
  assert.equal(L.elszamolas(3, 100, {}).meghatarozo, 'fizikai');
  assert.throws(() => L.elszamolas(1, 1, { szabaly: 'x' }));
  assert.throws(() => L.elszamolas(1, 1, { kgPerLdm: 0 }));
});
test('a díjszámítási LDM eltérhet a fizikaitól – a modul jelzi', () => {
  const b = [box({ weight: 4000 })];
  const a = L.elemzes({ trailer: T(), boxes: b, elszamolas: { szabaly: 'maximum' } });
  assert.ok(a.dijszamitas.elszamolasiLdm > a.fizikai.ldm);
  assert.ok(a.elteresek.some((s) => s.startsWith('Díjszámítási')));
});

// ---------------------------------------------------------------- Összehasonlítás és adatcsomag
test('három terv összehasonlítása', () => {
  const t1 = { nev: 'Hosszanti', trailer: T(), boxes: [box(), box({ y: 80 }), box({ y: 160 }), box({ x: 120 })] };
  const t2 = { nev: 'Forgatott', trailer: T(), boxes: [box({ rot: 1 }), box({ rot: 1, y: 120 }), box({ rot: 1, x: 80 }), box({ rot: 1, x: 80, y: 120 })] };
  const t3 = { nev: 'Halmozott', trailer: T(), boxes: [box(), box({ z: 100 }), box({ y: 80 }), box({ y: 80, z: 100 })] };
  const rows = L.osszehasonlit([t1, t2, t3]);
  assert.deepEqual(rows.map((r) => r.fizikaiLdm), [2.4, 1.6, 1.2]);
  assert.ok(rows.every((r) => r.megfelel));
  assert.equal(rows[2].kihasznaltAlapteruletM2, 2 * 0.96);
  assert.ok(rows.every((r) => r.osszTomegKg === 1200));
});
test('FuvarDíj 4.0 csomag tartalma', () => {
  const b = [box({ label: 'RAK-1' }), box({ z: 100, rot: 1, length: 80, width: 80 })];
  const c = L.fuvardijCsomag({ nev: 'Teszt', trailer: T(), boxes: b }, '2026-11-08T00:00:00.000Z');
  assert.equal(c.format, 'fuvardij4-rakodasi-csomag');
  assert.equal(c.rakomanyok[0].azonosito, 'RAK-1');
  assert.deepEqual(c.rakomanyok[1].pozicio_cm, { x: 0, y: 0, z: 100 });
  assert.equal(c.rakomanyok[1].alatta_levo_belso_id, b[0].id);
  assert.equal(c.ldm.fizikai, 1.2);
  assert.equal(typeof c.ldm.dijszamitasi, 'number');
  assert.equal(c.dijszamitas.kg_per_ldm, 1750);
  assert.equal(c.arazas, null);
  assert.equal(c.ajanlatra_alkalmas, true);
  assert.ok(c.ellenorzes.nem_ellenorzott_feltetelek.length >= 5);
});
test('hiányos vagy hibás terv nem alkalmas ajánlatra', () => {
  assert.equal(L.fuvardijCsomag({ trailer: T(), boxes: [box(), box({ placed: false })] }).ajanlatra_alkalmas, false);
  assert.equal(L.fuvardijCsomag({ trailer: T(), boxes: [box(), box({ x: 10 })] }).ajanlatra_alkalmas, false);
});
test('nem igazolt ráterhelésű halmozásból nincs ajánlat (FuvarDíj 4.0 szabály)', () => {
  const c = L.fuvardijCsomag({ trailer: T(), boxes: [box({ maxLoadKg: null }), box({ z: 100 })] });
  assert.equal(c.ellenorzes.megfelel, true);
  assert.equal(c.ajanlatra_alkalmas, false);
  assert.ok(c.ajanlat_akadalyai.some((s) => s.includes('nem igazolt')));
  // ismeretlen ráterhelés halmozás nélkül nem akadály
  assert.equal(L.fuvardijCsomag({ trailer: T(), boxes: [box({ maxLoadKg: null })] }).ajanlatra_alkalmas, true);
});
