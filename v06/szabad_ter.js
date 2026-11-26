/*
 * Rakománytervező 3D V06 – szabad terek felismerése
 * -------------------------------------------------
 * 1. Maximális üres téglatestek (EMS – Empty Maximal Spaces): a rakodótérből egyenként „kivonjuk” a rakományokat.
 *    Ezek egymást átfedhetik, ezért ÖSSZEADNI NEM SZABAD őket – csak a legnagyobb összefüggő tér keresésére valók.
 * 2. Átfedésmentes felbontás: a legnagyobb EMS-t kiválasztjuk, majd azt is kivonjuk a maradékból, és ismételjük.
 *    A listázott térrészek így nem fedik egymást, térfogatuk összeadható.
 * 3. A teljes szabad térfogat pontos értéke = belső térfogat − rakománytérfogat (érvényes, átfedésmentes tervben).
 * Minden érték egész cm. A minMeret-nél kisebb (bármely irányban) térrészek elhanyagolhatók.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./geometria.js'));
  else root.SzabadTer = factory(root.Geometria);
})(typeof self !== 'undefined' ? self : this, function (G) {
  'use strict';

  const eleg = (s, m) => s.x1 - s.x0 >= m && s.y1 - s.y0 >= m && s.z1 - s.z0 >= m;
  const tartalmaz = (a, b) => a.x0 <= b.x0 && a.x1 >= b.x1 && a.y0 <= b.y0 && a.y1 >= b.y1 && a.z0 <= b.z0 && a.z1 >= b.z1;

  /** Egy téglatest kivonása az üres terek listájából, a kis és a tartalmazott terek elhagyásával. */
  function kivon(terek, b, minMeret) {
    const uj = [];
    for (const s of terek) {
      if (!G.atfed(s, b)) { uj.push(s); continue; }
      const darabok = [];
      if (b.x0 > s.x0) darabok.push({ ...s, x1: b.x0 });
      if (b.x1 < s.x1) darabok.push({ ...s, x0: b.x1 });
      if (b.y0 > s.y0) darabok.push({ ...s, y1: b.y0 });
      if (b.y1 < s.y1) darabok.push({ ...s, y0: b.y1 });
      if (b.z0 > s.z0) darabok.push({ ...s, z1: b.z0 });
      if (b.z1 < s.z1) darabok.push({ ...s, z0: b.z1 });
      for (const d of darabok) if (eleg(d, minMeret)) uj.push(d);
    }
    // Tartalmazott terek elhagyása (térfogat szerint csökkenő sorrendben).
    uj.sort((p, q) => G.terfogat(q) - G.terfogat(p));
    const out = [];
    for (const s of uj) if (!out.some((o) => tartalmaz(o, s))) out.push(s);
    return out;
  }

  /** Maximális üres téglatestek. @param {object[]} dobozok AABB-k ({x0..z1}) */
  function maximalisTerek(t, dobozok, minMeret = 20) {
    let terek = [{ x0: 0, x1: t.length, y0: 0, y1: t.width, z0: 0, z1: t.height }];
    for (const b of dobozok) terek = kivon(terek, b, minMeret);
    return terek;
  }

  /** A legnagyobb összefüggő szabad téglatest térfogata (cm³) – a B terv célfüggvényéhez. */
  function legnagyobbTer(t, dobozok, minMeret = 20) {
    const m = maximalisTerek(t, dobozok, minMeret);
    return m.length ? { ter: m[0], terfogatCm3: G.terfogat(m[0]) } : { ter: null, terfogatCm3: 0 };
  }

  /** Átfedésmentes felbontás a legnagyobb térrészektől kezdve (legfeljebb max db). */
  function felbontas(t, dobozok, { minMeret = 20, max = 12 } = {}) {
    let terek = maximalisTerek(t, dobozok, minMeret);
    const lista = [];
    while (lista.length < max && terek.length) {
      const s = terek[0];
      lista.push(s);
      terek = kivon(terek, s, minMeret);
    }
    return lista;
  }

  /** Mely tételekből fér el legalább egy egység a térrészben (méret szerint; alátámasztás elhelyezéskor ellenőrzendő). */
  function javaslat(s, tetelek) {
    const dx = s.x1 - s.x0, dy = s.y1 - s.y0, dz = s.z1 - s.z0;
    return tetelek.filter((u) => {
      if (s.z0 > 0 && u.stackMode === 'nem') return false;
      const rots = u.rotatable === false ? [0] : [0, 1];
      return rots.some((r) => { const d = G.meretek(u, r); return d.l <= dx && d.w <= dy && d.h <= dz; });
    });
  }

  /** Szabadtér-összesítő egy tervhez. boxes: egész cm-es egységek (placed mezővel). */
  function elemez(t, boxes, beall = {}) {
    const placed = boxes.filter((b) => b.placed).map((b) => G.doboz(b));
    const belso = t.length * t.width * t.height;
    const foglalt = placed.reduce((s, v) => s + G.terfogat(v), 0);
    const maxX = placed.length ? Math.max(...placed.map((v) => v.x1)) : 0;
    const terek = felbontas(t, placed, beall);
    return {
      belsoTerfogatCm3: belso,
      foglaltTerfogatCm3: foglalt,
      szabadTerfogatCm3: belso - foglalt,          // pontos, többszörös beszámítás nélkül
      hatsoSzabadHosszCm: Math.max(0, t.length - maxX),
      hatsoSzabadTerfogatCm3: Math.max(0, t.length - maxX) * t.width * t.height,
      terek: terek.map((s, i) => ({
        azonosito: 'SZ' + String(i + 1).padStart(2, '0'),
        ...s,
        hosszCm: s.x1 - s.x0, szelessegCm: s.y1 - s.y0, magassagCm: s.z1 - s.z0,
        terfogatM3: G.terfogat(s) / 1e6,
        padloteruletM2: s.z0 === 0 ? (s.x1 - s.x0) * (s.y1 - s.y0) / 1e4 : null,
        hely: s.z0 === 0 ? (s.x0 >= maxX ? 'raktér vége' : 'padlószinten') : 'rakomány felett',
      })),
      felsoroltTerfogatCm3: terek.reduce((s, v) => s + G.terfogat(v), 0),
      megjegyzes: 'A felsorolt térrészek nem fedik egymást. A teljes szabad térfogat a belső térfogat és a rakománytérfogat különbsége.',
    };
  }

  return { kivon, maximalisTerek, legnagyobbTer, felbontas, javaslat, elemez };
});
