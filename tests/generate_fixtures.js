// Egyezési (paritás) esetek és mintatervek előállítása a Python-oldali tesztekhez.
// Futtatás: node tests/generate_fixtures.js
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const L = require('../ldm_modul.js');

let s = 20261108;
const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const pick = (a) => a[Math.floor(rnd() * a.length)];

// 1) Díjszámítási LDM: minden szabály × kerekítés, véletlen és szélső értékekkel
const cases = [];
const fizikaiak = [0, 0.01, 0.1, 1.2, 2, 2.0000000001, 2.05, 2.25, 2.35, 4.4, 13.2, 13.6];
const tomegek = [0, 1, 1750, 3500, 4000, 4375, 24000];
for (let i = 0; i < 600; i++) {
  const fiz = i < 84 ? fizikaiak[i % fizikaiak.length] : Math.round(rnd() * 1360) / 100;
  const kg = i < 84 ? tomegek[i % tomegek.length] : Math.round(rnd() * 3000000) / 100;
  const cfg = { kgPerLdm: pick([1750, 1750, 1500, 1000, 333.3, 2000]), szabaly: pick(L.ELSZAMOLASI_SZABALYOK), kerekites: pick(Object.keys(L.KEREKITESI_SZABALYOK)) };
  const r = L.elszamolas(fiz, kg, cfg);
  cases.push({ fizikai: fiz, kg, cfg, elszamolasi_ldm: r.elszamolasiLdm, tomegalapu_ldm: r.tomegalapuLdm, meghatarozo: r.meghatarozo });
}
// minden kerekítési szabály × szélső értékek
for (const k of Object.keys(L.KEREKITESI_SZABALYOK))
  for (const v of [0.05, 0.15, 0.25, 0.3, 0.30000000000000004, 1.005, 2.45, 7.125, 9.999999999, 0.1 + 0.2])
    cases.push({ kerekites_teszt: true, ertek: v, szabaly: k, eredmeny: L.kerekit(v, k) });

// 2) Elméleti LDM: véletlen méretek
const elm = [];
for (let i = 0; i < 200; i++) {
  const d = 1 + Math.floor(rnd() * 40), h = 20 + Math.floor(rnd() * 580), w = 20 + Math.floor(rnd() * 225), ref = pick([245, 240, 248]);
  elm.push({ darab: d, hossz: h, szelesseg: w, ref, ldm: L.elmeletiLdm(d, h, w, ref) });
}
fs.mkdirSync(path.join(__dirname, 'fixtures'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'fixtures', 'parity_cases.json'), JSON.stringify({ elszamolas: cases, elmeleti: elm }, null, 1));

// 3) Mintatervek: három változat ugyanarra a 12 EUR raklapra + egy hibás terv
const T = { type: 'Normál', length: 1360, width: 245, height: 270, payloadKg: 24000 };
let id = 0;
const pal = (o) => ({ id: ++id, label: `EUR-${String(id).padStart(2, '0')}`, type: 'EUR-raklap', color: '#8d78fc', length: 120, width: 80, height: 110, weight: 450, stackable: true, maxLayers: 2, maxLoadKg: 600, rot: 0, placed: true, x: 0, y: 0, z: 0, ...o });
const elsz = { kgPerLdm: 1750, szabaly: 'maximum', kerekites: 'Felfelé 0,1 LDM-re' };
const reset = () => { id = 0; };
reset(); const hosszanti = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) hosszanti.push(pal({ x: r * 120, y: c * 80 }));
reset(); const keresztben = []; for (let r = 0; r < 6; r++) for (let c = 0; c < 2; c++) keresztben.push(pal({ rot: 1, x: r * 80, y: c * 120 }));
reset(); const halmozott = []; for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { halmozott.push(pal({ x: r * 120, y: c * 80 })); halmozott.push(pal({ x: r * 120, y: c * 80, z: 110 })); }
reset(); const hibas = [pal({}), pal({ x: 60 }), pal({ x: 300, z: 20 }), pal({ placed: false })];
const tervek = [
  { nev: 'A – hosszanti, halmozás nélkül', trailer: T, boxes: hosszanti, elszamolas: elsz },
  { nev: 'B – keresztben forgatva', trailer: T, boxes: keresztben, elszamolas: elsz },
  { nev: 'C – kétszintes halmozás', trailer: T, boxes: halmozott, elszamolas: elsz },
  { nev: 'D – hibás (ütközés, lebegés, kint maradt)', trailer: T, boxes: hibas, elszamolas: elsz },
];
const dir = path.join(__dirname, '..', 'mintatervek');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'mintatervek_3_valtozat.json'), JSON.stringify({ format: 'rakodastervezo-3d-tervgyujtemeny', version: 5, units: 'cm', plans: tervek.slice(0, 3) }, null, 2));
fs.writeFileSync(path.join(dir, 'mintaterv_hibas.json'), JSON.stringify({ format: 'rakodastervezo-3d-tervgyujtemeny', version: 5, units: 'cm', plans: [tervek[3]] }, null, 2));
const fixed = '2026-11-08T00:00:00.000Z';
tervek.forEach((t, i) => fs.writeFileSync(path.join(dir, `fuvardij4_csomag_${'ABCD'[i]}.json`), JSON.stringify(L.fuvardijCsomag(t, fixed), null, 2)));
const rows = L.osszehasonlit(tervek);
console.log(`${cases.length} díjszámítási, ${elm.length} elméleti eset, ${tervek.length} mintaterv.`);
for (const r of rows) console.log(`${r.nev.padEnd(44)} fiz ${r.fizikaiLdm.toFixed(2)}  díj ${r.dijszamitasiLdm.toFixed(2)}  elm ${r.elmeletiLdm.toFixed(3)}  alap ${r.kihasznaltAlapteruletM2.toFixed(2)} m²  szabad ${r.szabadTeruletM2.toFixed(2)} m²  ${r.megfelel ? 'OK' : 'HIBÁS'}  ${r.korlatozasok.length} megj.`);
