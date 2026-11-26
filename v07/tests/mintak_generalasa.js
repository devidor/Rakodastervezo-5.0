// A kötelező tesztesetek mintatervei (V06 JSON) és egy fuvardíjkalkulátor-export minta.
// Futtatás: node tests/mintak_generalasa.js → mintatervek/v06_*.json
'use strict';
const fs = require('fs');
const path = require('path');
const IO = require('../terv_io.js');
const O = require('../optimalizalo.js');

const STD = { type: 'Standard félpótkocsi', length: 1360, width: 245, height: 270, payloadKg: 24000 };
const DIR = path.join(__dirname, '..', 'mintatervek');
const SZINEK = ['#8d78fc', '#32bda9', '#f59f54'];
let id;
const tetel = (itemId, n, l, w, h, kg, extra = {}, szin = 0) => Array.from({ length: n }, (_, i) => ({
  id: id++, itemId, label: `${itemId}-${String(i + 1).padStart(2, '0')}`, type: 'EUR-raklap', color: SZINEK[szin],
  length: l, width: w, height: h, weight: kg, stackMode: 'nem', maxLayers: 1, maxLoadKg: null, rotatable: true, stop: null,
  rot: 0, placed: false, x: 0, y: 0, z: 0, ...extra,
}));
const ESETEK = [
  ['01_egyszeru', 'Teszt 1 – 10 db nem halmozható raklap', () => tetel('T01', 10, 120, 80, 100, 300)],
  ['02_halmozhato', 'Teszt 2 – 12 db, max. 3 szint, 600 kg', () => tetel('T01', 12, 120, 80, 80, 250, { stackMode: 'szint', maxLayers: 3, maxLoadKg: 600 })],
  ['03_vegyes', 'Teszt 3 – vegyes rakomány', () => [...tetel('T01', 6, 120, 80, 100, 350, { stackMode: 'szint', maxLayers: 2, maxLoadKg: 400 }, 0), ...tetel('T02', 4, 100, 100, 120, 450, { type: 'Láda' }, 1), ...tetel('T03', 3, 150, 70, 80, 200, { stackMode: 'semmi', type: 'Doboz' }, 2)]],
  ['04_tulmeretes', 'Teszt 4 – túlméretes rakomány', () => tetel('T01', 1, 300, 260, 200, 1000, { type: 'Gép / egyedi' })],
  ['05_tiltott_halmozas', 'Teszt 5 – semmi a tetejére', () => tetel('T01', 4, 120, 80, 100, 400, { stackMode: 'semmi' })],
  ['06_forgatas', 'Teszt 6 – forgatással 200 cm', () => tetel('T01', 4, 120, 100, 100, 300)],
  ['07_sulykorlat', 'Teszt 7 – 30 × 1000 kg', () => tetel('T01', 30, 120, 80, 100, 1000)],
  ['08_lerakodasi_sorrend', 'C terv – két lerakóhely', () => [...tetel('T01', 6, 120, 80, 100, 300, { stop: 1 }, 0), ...tetel('T02', 6, 120, 80, 100, 300, { stop: 2 }, 1)]],
];
const ido = '2026-11-26T12:00:00.000Z';
for (const [fajl, nev, gen] of ESETEK) {
  id = 1;
  const boxes = gen();
  fs.writeFileSync(path.join(DIR, `v06_teszt_${fajl}.json`), JSON.stringify(IO.ment({ nev, trailer: STD, boxes }, ido), null, 2) + '\n');
  const r = O.optimalizal({ trailer: STD, boxes }, { mod: 'intelligens', seed: 42, idokorlatMs: 60000 });
  const A = r.tervek.A;
  fs.writeFileSync(path.join(DIR, `v06_teszt_${fajl}_optimalizalt.json`), JSON.stringify(IO.ment({ nev: nev + ' – A terv', trailer: STD, boxes: A.boxes }, ido), null, 2) + '\n');
  if (fajl === '02_halmozhato') {
    const exp = IO.integracioExport({ nev, trailer: STD, boxes: A.boxes }, { mod: r.mod, cel: 'A', seed: r.seed, iteracio: r.iteracio, idoMs: r.idoMs, kimaradt: A.kimaradt }, ido);
    fs.writeFileSync(path.join(DIR, 'v06_fuvardij_export_minta.json'), JSON.stringify(exp, null, 2) + '\n');
  }
  console.log(fajl, '→', A.elhelyezett + '/' + A.osszes, A.fizikaiHosszCm + ' cm', A.allapotSzoveg);
}
