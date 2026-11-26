// Rakománytervező 3D V06 – teljesítménymérés (Node). Futtatás: node tests/teljesitmeny.js [--gyors]
// Rögzített seeddel generált vegyes rakomány 10, 50, 100 és 200 egységgel, mindhárom üzemmódban.
// Kimenet: tests/teljesitmeny_eredmeny.txt (csak ténylegesen mért adatok).
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const O = require('../optimalizalo.js');
const E = require('../ellenorzo.js');
const SZ = require('../szabad_ter.js');


const STD = { length: 1360, width: 245, height: 270, payloadKg: 24000 };
function rakomany(n, seed) {
  const rnd = O.mulberry32(seed), boxes = [];
  const tetelek = [];
  for (let i = 0; i < 6; i++) {
    const modok = ['nem', 'semmi', 'szint', 'szint'];
    tetelek.push({ length: 40 + 10 * Math.floor(rnd() * 9), width: 30 + 10 * Math.floor(rnd() * 8), height: 30 + 10 * Math.floor(rnd() * 8), weight: 20 + Math.floor(rnd() * 120), stackMode: modok[Math.floor(rnd() * 4)], maxLayers: 2 + Math.floor(rnd() * 3), maxLoadKg: 300 + Math.floor(rnd() * 700), rotatable: rnd() < 0.85 });
  }
  for (let i = 0; i < n; i++) boxes.push({ id: i + 1, ...tetelek[i % tetelek.length], rot: 0, placed: false, x: 0, y: 0, z: 0 });
  return boxes;
}
const fmt = (n, d = 2) => n.toFixed(d).replace('.', ',');
function kartonok(n) { return Array.from({ length: n }, (_, i) => ({ id: i + 1, length: [60, 80, 120][i % 3], width: [40, 60, 80][i % 3], height: [40, 50, 60][i % 3], weight: 20, stackMode: 'szint', maxLayers: 5, maxLoadKg: 200, rotatable: true, rot: 0, placed: false, x: 0, y: 0, z: 0 })); }
const csak = process.argv.includes('--gyors') ? ['gyors'] : ['gyors', 'intelligens', 'maximalis'];
const sorok = [];
sorok.push(`Rakománytervező 3D V06 – teljesítménymérés`);
sorok.push(`Dátum: ${new Date().toISOString()} · Node ${process.version} · ${os.cpus()[0].model} · ${os.cpus().length} szál`);
sorok.push(`Jármű: 1360 × 245 × 270 cm, 24 000 kg · rakomány: 6 vegyes tétel ismétlődve, seed = 1000 + n · optimalizáló seed = 42`);
sorok.push('');
sorok.push('egység | mód        | futási idő (s) | iteráció | megállás oka          | elhelyezett | fizikai helyigény (m) | alsó korlát (m) | érvényes | 1 greedy menet (ms) | ellenőrzés (ms) | szabadtér-elemzés (ms)');
for (const [sorozat, gen] of [['A sorozat – vegyes, nagyrészt nem halmozható (100 és 200 egység nem fér el egy járműben)', (n) => rakomany(n, 1000 + n)], ['B sorozat – halmozható kartonok (3 méret, max. 5 szint, 200 kg terhelhetőség)', kartonok]]) {
 sorok.push('', sorozat);
 for (const n of [10, 50, 100, 200]) {
  const boxes = gen(n);
  const t0 = process.hrtime.bigint(); O.elhelyez(STD, boxes.map(E.normalizal)); const greedyMs = Number(process.hrtime.bigint() - t0) / 1e6;
  for (const mod of csak) {
    const s = process.hrtime.bigint();
    const r = O.optimalizal({ trailer: STD, boxes }, { mod, seed: 42 });
    const ms = Number(process.hrtime.bigint() - s) / 1e6;
    const A = r.tervek.A;
    const e0 = process.hrtime.bigint(); const ok = E.ellenoriz(A).ok; const ellMs = Number(process.hrtime.bigint() - e0) / 1e6;
    const s0 = process.hrtime.bigint(); SZ.elemez(STD, A.boxes, { max: 12 }); const szMs = Number(process.hrtime.bigint() - s0) / 1e6;
    const ok2 = r.idoLejart ? 'időkorlát' : (r.tervek.A.k ? '' : (r.iteracio <= 7 ? 'determinisztikus kész' : 'iterációkorlát/alsó korlát'));
    sorok.push(`${String(n).padStart(6)} | ${mod.padEnd(10)} | ${fmt(ms / 1000, 3).padStart(14)} | ${String(r.iteracio).padStart(8)} | ${ok2.padEnd(21)} | ${(A.elhelyezett + '/' + A.osszes).padStart(11)} | ${fmt(A.fizikaiHosszCm / 100).padStart(21)} | ${fmt(r.alsoKorlatCm / 100).padStart(15)} | ${(ok ? 'igen' : 'NEM').padStart(8)} | ${fmt(greedyMs, 1).padStart(19)} | ${fmt(ellMs, 1).padStart(15)} | ${fmt(szMs, 1).padStart(22)}`);
    console.log(sorok[sorok.length - 1]);
  }
 }
}

fs.writeFileSync(path.join(__dirname, 'teljesitmeny_eredmeny.txt'), sorok.join('\n') + '\n', 'utf8');
console.log('\nMentve: tests/teljesitmeny_eredmeny.txt');
