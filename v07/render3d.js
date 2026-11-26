/*
 * Rakománytervező 3D V07 – fotorealisztikus WebGL-megjelenítés (three.js r149, helyben tárolva: vendor/three)
 * -------------------------------------------------------------------------------------------------------------
 * - PBR-anyagok (MeshStandard / MeshPhysical), procedurálisan generált textúrák (fa, hullámkarton, padló, ponyva,
 *   aszfalt, szőtt zsák, rács) – külső képfájl nélkül.
 * - Valós méretarányú modellek: EUR-/ipari/félraklap (talpdeszka, tuskók, keresztdeszkák, fedődeszkák),
 *   sztreccsfóliás árutömb, karton ragasztószalaggal és címkével, IBC, hordó, tekercs, gitterbox, láda, big bag, gép.
 * - Jármű: alváz, tengelyek és kerekek a profil szerinti helyen, padló, homlokfal, ponyva (áttetsző / metszet),
 *   nyitott hátsó ajtószárnyak, rögzítőpontok, nyerges vontató vagy fülke.
 * - Fény: környezeti tükröződés (generált stúdiókörnyezet, PMREM), lágy árnyékú irányfény, ACES tónusleképezés.
 * - A geometria anyagonként egyetlen összevont hálóba kerül (kevés rajzolási hívás – 300 egységnél is gyors).
 * - A megjelenítés nem torzít: minden méret a tervadat (egész cm) 1:1 léptékben, méterre váltva.
 *
 * Koordináták: a terv (x homlokfaltól, y bal faltól, z padlótól, cm) → three.js: X = x/100, Y = z/100, Z = −y/100
 * (jobbsodrású leképezés, nincs tükrözés).
 */
(function (root, factory) {
  root.Render3D = factory(root.THREE);
})(typeof self !== 'undefined' ? self : this, function (THREE) {
  'use strict';
  if (!THREE) return { tamogatott: () => false };

  const T = (x, y, z) => [x / 100, z / 100, -y / 100];
  const szin = (hex) => { const c = new THREE.Color(hex || '#ffffff'); return [c.r, c.g, c.b]; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const STOP_SZINEK = ['#e4572e', '#29a8ab', '#f3a712', '#6a4c93', '#4caf50', '#1982c4', '#ff595e', '#8ac926', '#c77dff', '#ffca3a'];
  const stopSzin = (s) => (s ? STOP_SZINEK[(s - 1) % STOP_SZINEK.length] : '#9aa5b8');

  // ------------------------------------------------------------------------------------------------------------
  // Procedurális textúrák
  // ------------------------------------------------------------------------------------------------------------
  function vaszon(w, h, rajz) { const c = document.createElement('canvas'); c.width = w; c.height = h; rajz(c.getContext('2d'), w, h); return c; }
  function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function zaj(g, w, h, db, min, max, r, alfa = 0.08) {
    for (let i = 0; i < db; i++) { const v = Math.floor(min + r() * (max - min)); g.fillStyle = `rgba(${v},${v},${v},${alfa})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
  }
  function textura(c, ism = true, srgb = true) {
    const t = new THREE.CanvasTexture(c);
    if (ism) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 8;
    return t;
  }
  const TX = {};
  function texturak() {
    if (TX.kesz) return TX;
    const r = rnd(7);
    TX.fa = textura(vaszon(256, 256, (g, w, h) => {
      g.fillStyle = '#c8a372'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 1) { const v = 0.5 + 0.5 * Math.sin(y * 0.35 + Math.sin(y * 0.05) * 3); g.fillStyle = `rgba(120,80,40,${0.05 + 0.1 * v * r()})`; g.fillRect(0, y, w, 1); }
      for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(90,55,25,0.35)'; g.beginPath(); g.ellipse(r() * w, r() * h, 3 + r() * 4, 2 + r() * 3, 0, 0, 7); g.fill(); }
      zaj(g, w, h, 3000, 40, 220, r);
    }));
    TX.karton = textura(vaszon(256, 256, (g, w, h) => {
      g.fillStyle = '#b98b58'; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 4) { g.fillStyle = 'rgba(80,50,20,0.06)'; g.fillRect(x, 0, 1, h); }
      zaj(g, w, h, 4000, 60, 200, r, 0.07);
    }));
    // Árutömb kartonokból: 120 cm-es ismétlődés → 3 karton (40 cm) × 4 sor (30 cm), illesztésekkel és szalaggal.
    TX.kartonRacs = textura(vaszon(512, 512, (g, w, h) => {
      g.fillStyle = '#bb8d5a'; g.fillRect(0, 0, w, h);
      zaj(g, w, h, 9000, 60, 200, r, 0.06);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) {
        const x = (i * w) / 3, y = (j * h) / 4, cw = w / 3, ch = h / 4;
        g.fillStyle = `rgba(${150 + r() * 30},${105 + r() * 25},${60 + r() * 20},0.25)`; g.fillRect(x + 2, y + 2, cw - 4, ch - 4);
        g.fillStyle = 'rgba(205,170,120,0.55)'; g.fillRect(x + 2, y + ch / 2 - 6, cw - 4, 12);
        g.strokeStyle = 'rgba(60,35,15,0.55)'; g.lineWidth = 2.5; g.strokeRect(x + 1, y + 1, cw - 2, ch - 2);
      }
    }));
    TX.padlo = textura(vaszon(512, 512, (g, w, h) => {
      g.fillStyle = '#4a3020'; g.fillRect(0, 0, w, h);
      for (let j = 0; j < 8; j++) {
        const y = (j * h) / 8;
        g.fillStyle = `rgba(${90 + r() * 25},${58 + r() * 15},${35 + r() * 10},0.8)`; g.fillRect(0, y + 1, w, h / 8 - 2);
        for (let k = 0; k < 40; k++) { g.fillStyle = 'rgba(30,18,10,0.15)'; g.fillRect(0, y + 2 + r() * (h / 8 - 4), w, 1); }
        g.fillStyle = 'rgba(15,8,4,0.9)'; g.fillRect(0, y, w, 1.5);
      }
      for (let x = 0; x < w; x += 10) for (let y = 0; y < h; y += 10) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + ((y / 10) % 2) * 5, y, 3, 3); }
    }));
    TX.ponyva = textura(vaszon(256, 256, (g, w, h) => {
      g.fillStyle = '#41597c'; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 2) { g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(x, 0, 1, h); }
      zaj(g, w, h, 2000, 100, 220, r, 0.05);
    }));
    TX.aszfalt = textura(vaszon(512, 512, (g, w, h) => {
      g.fillStyle = '#3b3e44'; g.fillRect(0, 0, w, h);
      zaj(g, w, h, 30000, 20, 160, r, 0.25);
    }));
    TX.zsak = textura(vaszon(128, 128, (g, w, h) => {
      g.fillStyle = '#e7e4da'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < w; i += 3) { g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(i, 0, 1, h); g.fillRect(0, i, w, 1); }
    }));
    TX.lada = textura(vaszon(256, 256, (g, w, h) => {
      g.fillStyle = '#b48a55'; g.fillRect(0, 0, w, h);
      for (let j = 0; j < 6; j++) { g.fillStyle = 'rgba(70,40,15,0.6)'; g.fillRect(0, (j * h) / 6, w, 2); for (let k = 0; k < 14; k++) { g.fillStyle = 'rgba(90,55,25,0.12)'; g.fillRect(0, (j * h) / 6 + r() * (h / 6), w, 1); } }
      zaj(g, w, h, 3000, 40, 200, r);
    }));
    const racs = vaszon(128, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.strokeStyle = '#c9ced4'; g.lineWidth = 3;
      for (let i = 0; i <= w; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
    });
    TX.racs = textura(racs);
    // Címkék (lerakószám) atlasza: 8 × 16 cella, 0 = lerakó nélkül.
    TX.cimkeAtlasz = textura(vaszon(1024, 2048, (g) => {
      for (let i = 0; i < 128; i++) {
        const x = (i % 8) * 128, y = Math.floor(i / 8) * 128;
        g.fillStyle = '#fbfbf7'; g.fillRect(x + 2, y + 2, 124, 124);
        g.fillStyle = '#111'; for (let k = 0; k < 34; k++) { const bw = 1 + ((k * 7 + i) % 3); g.fillRect(x + 12 + k * 3, y + 92, bw, 26); }
        g.font = 'bold 54px Arial'; g.textAlign = 'center'; g.fillText(i ? String(i) : '–', x + 64, y + 62);
        g.font = 'bold 14px Arial'; g.fillText(i ? 'LERAKÓ' : 'RAKOMÁNY', x + 64, y + 82);
      }
    }), false);
    TX.kesz = true;
    return TX;
  }

  // ------------------------------------------------------------------------------------------------------------
  // Összevont geometria-építő (cm-es tervkoordinátákban, three.js méterre váltva)
  // ------------------------------------------------------------------------------------------------------------
  class Epito {
    constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.i = []; }
    vert(pt, nr, uv, col) { this.p.push(...T(...pt)); this.n.push(nr[0], nr[2], -nr[1]); this.u.push(uv[0], uv[1]); this.c.push(col[0], col[1], col[2]); return this.p.length / 3 - 1; }
    quad(a, b, c, d, nr, uvs, cols) {
      const i0 = this.vert(a, nr, uvs[0], cols[0]), i1 = this.vert(b, nr, uvs[1], cols[1]), i2 = this.vert(c, nr, uvs[2], cols[2]), i3 = this.vert(d, nr, uvs[3], cols[3]);
      this.i.push(i0, i1, i2, i0, i2, i3);
    }
    /** Téglatest. o: {uv: cm / textúraismétlés, ao: alsó élek sötétítése, lapok: kihagyandó lapok halmaza} */
    box(x0, x1, y0, y1, z0, z1, col, o = {}) {
      if (x1 <= x0 || y1 <= y0 || z1 <= z0) return;
      const s = o.uv || 100, ao = o.ao === false ? 1 : 0.55, k = o.kihagy || '';
      const cb = [col[0] * ao, col[1] * ao, col[2] * ao], ct = col;
      const L = (a) => a / s;
      if (!k.includes('+x')) this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0], [[L(y0), L(z0)], [L(y1), L(z0)], [L(y1), L(z1)], [L(y0), L(z1)]], [cb, cb, ct, ct]);
      if (!k.includes('-x')) this.quad([x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [-1, 0, 0], [[L(-y1), L(z0)], [L(-y0), L(z0)], [L(-y0), L(z1)], [L(-y1), L(z1)]], [cb, cb, ct, ct]);
      if (!k.includes('+y')) this.quad([x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [0, 1, 0], [[L(-x1), L(z0)], [L(-x0), L(z0)], [L(-x0), L(z1)], [L(-x1), L(z1)]], [cb, cb, ct, ct]);
      if (!k.includes('-y')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [[L(x0), L(z0)], [L(x1), L(z0)], [L(x1), L(z1)], [L(x0), L(z1)]], [cb, cb, ct, ct]);
      if (!k.includes('+z')) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [[L(x0), L(y0)], [L(x1), L(y0)], [L(x1), L(y1)], [L(x0), L(y1)]], [ct, ct, ct, ct]);
      if (!k.includes('-z')) this.quad([x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0], [0, 0, -1], [[L(x0), L(-y1)], [L(x1), L(-y1)], [L(x1), L(-y0)], [L(x0), L(-y0)]], [cb, cb, cb, cb]);
    }
    /** Henger: tengely 'x' | 'y' | 'z', c = középpont, r = sugár, h = hossz. */
    henger(tengely, c, r, h, col, n = 24, o = {}) {
      const pt = (a, t) => {
        if (tengely === 'z') return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a), c[2] + t];
        if (tengely === 'x') return [c[0] + t, c[1] + r * Math.cos(a), c[2] + r * Math.sin(a)];
        return [c[0] + r * Math.sin(a), c[1] + t, c[2] + r * Math.cos(a)];
      };
      const nr = (a) => (tengely === 'z' ? [Math.cos(a), Math.sin(a), 0] : tengely === 'x' ? [0, Math.cos(a), Math.sin(a)] : [Math.sin(a), 0, Math.cos(a)]);
      const ax = tengely === 'z' ? [0, 0, 1] : tengely === 'x' ? [1, 0, 0] : [0, 1, 0];
      const h0 = -h / 2, h1 = h / 2, s = o.uv || 100, cs = o.sapka === false ? null : (o.sapkaSzin || col);
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, u0 = (a0 * r) / s, u1 = (a1 * r) / s;
        const A = this.vert(pt(a0, h0), nr(a0), [u0, h0 / s], col), Bv = this.vert(pt(a1, h0), nr(a1), [u1, h0 / s], col);
        const Cv = this.vert(pt(a1, h1), nr(a1), [u1, h1 / s], col), D = this.vert(pt(a0, h1), nr(a0), [u0, h1 / s], col);
        this.i.push(A, Bv, Cv, A, Cv, D);
        if (cs) {
          const k1 = this.vert(pt(0, h1).map((v, j) => (j === 0 && tengely === 'x') || (j === 1 && tengely === 'y') || (j === 2 && tengely === 'z') ? v : c[j]), ax, [0, 0], cs);
          const p0 = this.vert(pt(a0, h1), ax, [Math.cos(a0) * 0.5, Math.sin(a0) * 0.5], cs), p1 = this.vert(pt(a1, h1), ax, [Math.cos(a1) * 0.5, Math.sin(a1) * 0.5], cs);
          this.i.push(k1, p0, p1);
          const na = ax.map((v) => -v);
          const k0 = this.vert(pt(0, h0).map((v, j) => (j === 0 && tengely === 'x') || (j === 1 && tengely === 'y') || (j === 2 && tengely === 'z') ? v : c[j]), na, [0, 0], cs);
          const q0 = this.vert(pt(a0, h0), na, [0, 0], cs), q1 = this.vert(pt(a1, h0), na, [0, 0], cs);
          this.i.push(k0, q1, q0);
        }
      }
    }
    /** Vékony szalag két pont között (y-z síkban, x körül b szélességben) – pántokhoz. */
    szalag(x, a, b, szel, col) {
      const nz = [0, b[1] - a[1], b[2] - a[2]], hossz = Math.hypot(nz[1], nz[2]) || 1;
      const nr = [0, -nz[2] / hossz, nz[1] / hossz];
      this.quad([x - szel / 2, a[1], a[2]], [x + szel / 2, a[1], a[2]], [x + szel / 2, b[1], b[2]], [x - szel / 2, b[1], b[2]], nr, [[0, 0], [1, 0], [1, 1], [0, 1]], [col, col, col, col]);
    }
    hal(anyag, opt = {}) {
      if (!this.i.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
      g.setIndex(this.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, anyag);
      m.castShadow = opt.arnyek !== false; m.receiveShadow = opt.fogad !== false;
      if (opt.sorrend != null) m.renderOrder = opt.sorrend;
      return m;
    }
  }

  // ------------------------------------------------------------------------------------------------------------
  // Anyagok
  // ------------------------------------------------------------------------------------------------------------
  function anyagok() {
    const tx = texturak();
    const S = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, ...o });
    return {
      fa: S({ map: tx.fa, roughness: 0.85 }),
      karton: S({ map: tx.karton, roughness: 0.9 }),
      kartonRacs: S({ map: tx.kartonRacs, roughness: 0.9 }),
      szalag: S({ color: 0xc9a56b, roughness: 0.35 }),
      folia: new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, depthWrite: false, envMapIntensity: 1.6 }),
      cimke: S({ map: tx.cimkeAtlasz, roughness: 0.6 }),
      festett: S({ roughness: 0.55, metalness: 0.1 }),
      fem: S({ roughness: 0.45, metalness: 0.6 }),
      acel: S({ roughness: 0.32, metalness: 0.9 }),
      ibc: new THREE.MeshPhysicalMaterial({ vertexColors: true, color: 0xf2f2ee, roughness: 0.35, transparent: true, opacity: 0.86, clearcoat: 0.4 }),
      racs: S({ map: tx.racs, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.7, roughness: 0.35, transparent: false }),
      zsak: S({ map: tx.zsak, roughness: 0.95 }),
      lada: S({ map: tx.lada, roughness: 0.85 }),
      gumi: S({ color: 0x1b1b1d, roughness: 0.92 }),
      pant: S({ color: 0xf07d1a, roughness: 0.55, side: THREE.DoubleSide }),
      elvedo: S({ color: 0x2f3237, roughness: 0.6 }),
      legzsak: S({ color: 0xd8c9a8, roughness: 0.8 }),
      padlo: S({ map: tx.padlo, roughness: 0.7 }),
      ponyva: S({ map: tx.ponyva, roughness: 0.75, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }),
      panel: S({ roughness: 0.4, metalness: 0.15 }),
      alvaz: S({ color: 0x24272c, roughness: 0.6, metalness: 0.5 }),
      kabin: S({ roughness: 0.3, metalness: 0.25, envMapIntensity: 1.2 }),
      uveg: new THREE.MeshPhysicalMaterial({ color: 0x1b2633, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85, clearcoat: 1 }),
      felni: S({ color: 0xbfc4ca, roughness: 0.25, metalness: 0.95 }),
      talaj: new THREE.MeshStandardMaterial({ map: tx.aszfalt, roughness: 0.95, color: 0x9aa0a8 }),
      szellem: new THREE.MeshStandardMaterial({ color: 0x42d59e, transparent: true, opacity: 0.32, depthWrite: false, roughness: 0.5 }),
      szellemRossz: new THREE.MeshStandardMaterial({ color: 0xff5e82, transparent: true, opacity: 0.32, depthWrite: false, roughness: 0.5 }),
      ter: new THREE.MeshBasicMaterial({ color: 0x40d6ff, transparent: true, opacity: 0.1, depthWrite: false }),
      terAktiv: new THREE.MeshBasicMaterial({ color: 0x5fe1ff, transparent: true, opacity: 0.24, depthWrite: false }),
    };
  }

  // ------------------------------------------------------------------------------------------------------------
  // Egységmodellek
  // ------------------------------------------------------------------------------------------------------------
  const RAKLAP_M = 14.4;
  function raklap(E, v, hosszX, col) {
    // hosszX: a raklap hossza (fedődeszkák iránya) x irányú-e.
    const fa = mix(szin('#ffffff'), col, 0.0);
    const L = hosszX ? v.x1 - v.x0 : v.y1 - v.y0, W = hosszX ? v.y1 - v.y0 : v.x1 - v.x0;
    const b = (a0, a1, c0, c1, z0, z1) => (hosszX ? E.fa.box(v.x0 + a0, v.x0 + a1, v.y0 + c0, v.y0 + c1, v.z0 + z0, v.z0 + z1, fa, { uv: 60 }) : E.fa.box(v.x0 + c0, v.x0 + c1, v.y0 + a0, v.y0 + a1, v.z0 + z0, v.z0 + z1, fa, { uv: 60 }));
    const sor = (n, teljes, szel) => Array.from({ length: n }, (_, i) => (n === 1 ? (teljes - szel) / 2 : (i * (teljes - szel)) / (n - 1)));
    for (const c of sor(3, W, 10)) b(0, L, c, c + 10, 0, 2.2);                                         // talpdeszkák (hosszirányban)
    for (const a of sor(3, L, 14.5)) for (const c of sor(3, W, 10)) b(a, a + 14.5, c, c + 10, 2.2, 10); // 9 tuskó
    for (const a of sor(3, L, 14.5)) b(a, a + 14.5, 0, W, 10, 12.2);                                    // keresztdeszkák
    const fedo = sor(5, W, 12);
    fedo.forEach((c, i) => b(0, L, c, c + (i % 2 ? 10 : 14.5) > W ? W - c : c + (i % 2 ? 10 : 14.5), 12.2, RAKLAP_M)); // fedődeszkák
  }
  /** Címke a kivételi oldal felőli lapon (lerakószám) + színes jelölő. */
  function cimke(E, v, stop, oldal, jelolo) {
    const atl = Math.min(99, stop || 0), cx = atl % 8, cy = Math.floor(atl / 8);
    const u0 = cx / 8, u1 = (cx + 1) / 8, v1 = 1 - cy / 16, v0 = 1 - (cy + 1) / 16;
    const m = Math.max(10, Math.min(22, (v.z1 - v.z0) * 0.3)), z1 = v.z1 - 6, z0 = z1 - m, w = col0 => col0;
    const fe = [1, 1, 1];
    const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    if (oldal === 'bal' || oldal === 'jobb') {
      const y = oldal === 'bal' ? v.y0 - 0.3 : v.y1 + 0.3, x0 = (v.x0 + v.x1) / 2 - m / 2, x1 = x0 + m;
      if (oldal === 'bal') E.cimke.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, -1, 0], uvs, [fe, fe, fe, fe]);
      else E.cimke.quad([x1, y, z0], [x0, y, z0], [x0, y, z1], [x1, y, z1], [0, 1, 0], uvs, [fe, fe, fe, fe]);
      E.festett.box(x1 + 2, x1 + 8, y - 0.2, y + 0.2, z1 - 6, z1, jelolo, { ao: false });
    } else {
      const x = v.x1 + 0.3, y0 = (v.y0 + v.y1) / 2 - m / 2, y1 = y0 + m;
      E.cimke.quad([x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1], [1, 0, 0], uvs, [fe, fe, fe, fe]);
      E.festett.box(x - 0.2, x + 0.2, y1 + 2, y1 + 8, z1 - 6, z1, jelolo, { ao: false });
    }
    void w;
  }
  function egysegModell(E, b, v, mod, oldal) {
    const cs = b.csomagolas || 'doboz', egyseg = szin(b.color), stop = stopSzin(b.stop);
    const tint = mod === 'lerako' ? szin(stop) : mod === 'egyseg' ? egyseg : null;
    const jelolo = mod === 'lerako' ? egyseg : szin(stop);
    const hosszX = !b.rot;
    const valt = 0.92 + ((b.id * 9301 + 49297) % 233280) / 233280 * 0.12; // apró színváltozat
    const kv = [valt, valt * 0.99, valt * 0.97];
    const test = (x0, x1, y0, y1, z0, z1, anyag, o) => {
      if (tint) E.festett.box(x0, x1, y0, y1, z0, z1, mix(tint, [1, 1, 1], 0.12), o);
      else E[anyag].box(x0, x1, y0, y1, z0, z1, kv, o);
    };
    const raklapos = ['eur_raklap', 'ind_raklap', 'fel_raklap'].includes(cs);
    if (raklapos && v.z1 - v.z0 > 25) {
      raklap(E, v, hosszX, [1, 1, 1]);
      const z0 = v.z0 + RAKLAP_M, i = 1;
      test(v.x0 + i, v.x1 - i, v.y0 + i, v.y1 - i, z0, v.z1 - 0.6, 'kartonRacs', { uv: 120 });
      E.folia.box(v.x0 + i - 0.6, v.x1 - i + 0.6, v.y0 + i - 0.6, v.y1 - i + 0.6, z0 - 3, v.z1, [1, 1, 1], { ao: false, kihagy: '-z' });
      cimke(E, { ...v, x0: v.x0 + i, x1: v.x1 - i + 0.6, y0: v.y0 + i - 0.6, y1: v.y1 - i + 0.6 }, b.stop, oldal, jelolo);
      return;
    }
    if (cs === 'gitterbox') {
      const lab = 12;
      for (const [x, y] of [[v.x0, v.y0], [v.x1 - 12, v.y0], [v.x0, v.y1 - 12], [v.x1 - 12, v.y1 - 12]]) E.acel.box(x, x + 12, y, y + 12, v.z0, v.z0 + lab, [0.85, 0.86, 0.88]);
      E.acel.box(v.x0, v.x1, v.y0, v.y1, v.z0 + lab, v.z0 + lab + 3, [0.8, 0.82, 0.85]);
      test(v.x0 + 4, v.x1 - 4, v.y0 + 4, v.y1 - 4, v.z0 + lab + 3, v.z0 + lab + 3 + (v.z1 - v.z0 - lab - 6) * 0.7, 'karton', { uv: 60 });
      const z0 = v.z0 + lab + 3, z1 = v.z1;
      E.racs.box(v.x0 + 1, v.x1 - 1, v.y0 + 1, v.y1 - 1, z0, z1 - 2, [1, 1, 1], { uv: 40, ao: false, kihagy: '+z-z' });
      for (const [x0, x1, y0, y1] of [[v.x0, v.x1, v.y0, v.y0 + 3], [v.x0, v.x1, v.y1 - 3, v.y1], [v.x0, v.x0 + 3, v.y0, v.y1], [v.x1 - 3, v.x1, v.y0, v.y1]]) E.acel.box(x0, x1, y0, y1, z1 - 3, z1, [0.85, 0.86, 0.88]);
      for (const [x, y] of [[v.x0, v.y0], [v.x1 - 3, v.y0], [v.x0, v.y1 - 3], [v.x1 - 3, v.y1 - 3]]) E.acel.box(x, x + 3, y, y + 3, z0, z1, [0.85, 0.86, 0.88]);
      cimke(E, v, b.stop, oldal, jelolo);
      return;
    }
    if (cs === 'ibc') {
      E.fem.box(v.x0, v.x1, v.y0, v.y1, v.z0, v.z0 + 14, [0.3, 0.32, 0.35]);
      E.ibc.box(v.x0 + 3, v.x1 - 3, v.y0 + 3, v.y1 - 3, v.z0 + 14, v.z1 - 5, tint ? mix(tint, [1, 1, 1], 0.6) : [1, 1, 1]);
      const z0 = v.z0 + 14, z1 = v.z1 - 1, g = [0.78, 0.8, 0.83];
      const lx = v.x1 - v.x0, ly = v.y1 - v.y0;
      for (let k = 0; k <= Math.round(lx / 20); k++) { const x = v.x0 + (k * (lx - 2)) / Math.round(lx / 20); E.acel.box(x, x + 2, v.y0, v.y0 + 1.6, z0, z1, g); E.acel.box(x, x + 2, v.y1 - 1.6, v.y1, z0, z1, g); }
      for (let k = 0; k <= Math.round(ly / 20); k++) { const y = v.y0 + (k * (ly - 2)) / Math.round(ly / 20); E.acel.box(v.x0, v.x0 + 1.6, y, y + 2, z0, z1, g); E.acel.box(v.x1 - 1.6, v.x1, y, y + 2, z0, z1, g); }
      for (let k = 1; k <= 4; k++) { const z = z0 + (k * (z1 - z0)) / 4 - 2; E.acel.box(v.x0, v.x1, v.y0, v.y0 + 1.6, z, z + 2, g); E.acel.box(v.x0, v.x1, v.y1 - 1.6, v.y1, z, z + 2, g); E.acel.box(v.x0, v.x0 + 1.6, v.y0, v.y1, z, z + 2, g); E.acel.box(v.x1 - 1.6, v.x1, v.y0, v.y1, z, z + 2, g); }
      E.festett.henger('z', [(v.x0 + v.x1) / 2, (v.y0 + v.y1) / 2, v.z1 - 3], 7.5, 6, [0.25, 0.25, 0.28], 16);
      cimke(E, v, b.stop, oldal, jelolo);
      return;
    }
    if (cs === 'hordo') {
      let z0 = v.z0;
      const lx = v.x1 - v.x0, ly = v.y1 - v.y0;
      if (Math.min(lx, ly) >= 70 && v.z1 - v.z0 > 60) { raklap(E, v, hosszX, [1, 1, 1]); z0 += RAKLAP_M; }
      const d = Math.min(lx, ly) < 70 ? Math.min(lx, ly) : 58, nx = Math.max(1, Math.floor(lx / d)), ny = Math.max(1, Math.floor(ly / d));
      const r = d / 2 - 1, h = v.z1 - z0, col = tint || szin('#2b5ea7');
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const cx = v.x0 + (lx / nx) * (i + 0.5), cy = v.y0 + (ly / ny) * (j + 0.5);
        E.fem.henger('z', [cx, cy, z0 + h / 2], r, h, col, 28, { sapkaSzin: mix(col, [0, 0, 0], 0.25) });
        for (const f of [0.33, 0.66]) E.fem.henger('z', [cx, cy, z0 + h * f], r + 0.8, 2, mix(col, [0, 0, 0], 0.15), 28, { sapka: false });
      }
      return;
    }
    if (cs === 'tekercs') {
      const tx = hosszX ? 'x' : 'y', lx = v.x1 - v.x0, ly = v.y1 - v.y0, h = v.z1 - v.z0;
      const r = Math.min(hosszX ? ly : lx, h) / 2 - 0.5, hossz = hosszX ? lx : ly;
      const c = [(v.x0 + v.x1) / 2, (v.y0 + v.y1) / 2, v.z0 + r + 0.5];
      E.acel.henger(tx, c, r, hossz - 1, tint || [0.72, 0.74, 0.77], 40, { sapkaSzin: [0.55, 0.57, 0.6] });
      E.gumi.henger(tx, c, r * 0.32, hossz - 0.6, [1, 1, 1], 24);
      for (const f of [0.15, 0.85]) {
        const p = hosszX ? v.x0 + lx * f : v.y0 + ly * f;
        if (hosszX) { E.fa.box(p - 6, p + 6, v.y0, v.y0 + ly * 0.3, v.z0, v.z0 + r * 0.5, [0.8, 0.7, 0.6]); E.fa.box(p - 6, p + 6, v.y1 - ly * 0.3, v.y1, v.z0, v.z0 + r * 0.5, [0.8, 0.7, 0.6]); }
        else { E.fa.box(v.x0, v.x0 + lx * 0.3, p - 6, p + 6, v.z0, v.z0 + r * 0.5, [0.8, 0.7, 0.6]); E.fa.box(v.x1 - lx * 0.3, v.x1, p - 6, p + 6, v.z0, v.z0 + r * 0.5, [0.8, 0.7, 0.6]); }
      }
      return;
    }
    if (cs === 'bigbag') {
      test(v.x0 + 2, v.x1 - 2, v.y0 + 2, v.y1 - 2, v.z0, v.z1 - 12, 'zsak', { uv: 50 });
      E.zsak.box(v.x0 + 8, v.x1 - 8, v.y0 + 8, v.y1 - 8, v.z1 - 12, v.z1 - 6, [0.95, 0.95, 0.93], { uv: 50 });
      for (const [x, y] of [[v.x0 + 4, v.y0 + 4], [v.x1 - 10, v.y0 + 4], [v.x0 + 4, v.y1 - 10], [v.x1 - 10, v.y1 - 10]]) E.zsak.box(x, x + 6, y, y + 6, v.z1 - 12, v.z1, [0.9, 0.9, 0.86], { uv: 50 });
      cimke(E, v, b.stop, oldal, jelolo);
      return;
    }
    if (cs === 'lada') {
      test(v.x0, v.x1, v.y0, v.y1, v.z0, v.z1, 'lada', { uv: 80 });
      const s = 5, c = [0.62, 0.48, 0.3];
      for (const [y0, y1] of [[v.y0 - 0.5, v.y0 + s], [v.y1 - s, v.y1 + 0.5]]) for (const [z0, z1] of [[v.z0, v.z0 + s], [v.z1 - s, v.z1 + 0.5]]) E.lada.box(v.x0 - 0.5, v.x1 + 0.5, y0, y1, z0, z1, c, { uv: 80 });
      for (const [x0, x1] of [[v.x0 - 0.5, v.x0 + s], [v.x1 - s, v.x1 + 0.5]]) for (const [y0, y1] of [[v.y0 - 0.5, v.y0 + s], [v.y1 - s, v.y1 + 0.5]]) E.lada.box(x0, x1, y0, y1, v.z0, v.z1, c, { uv: 80 });
      cimke(E, { ...v, x1: v.x1 + 0.6, y0: v.y0 - 0.6, y1: v.y1 + 0.6 }, b.stop, oldal, jelolo);
      return;
    }
    if (cs === 'gep') {
      E.alvaz && 0;
      E.fem.box(v.x0, v.x1, v.y0 + 4, v.y0 + 14, v.z0, v.z0 + 10, [0.25, 0.27, 0.3]);
      E.fem.box(v.x0, v.x1, v.y1 - 14, v.y1 - 4, v.z0, v.z0 + 10, [0.25, 0.27, 0.3]);
      const col = tint || szin(b.color || '#5b7a6a');
      E.festett.box(v.x0 + 2, v.x1 - 2, v.y0 + 2, v.y1 - 2, v.z0 + 10, v.z0 + (v.z1 - v.z0) * 0.72, col);
      E.festett.box(v.x0 + (v.x1 - v.x0) * 0.25, v.x1 - (v.x1 - v.x0) * 0.2, v.y0 + 8, v.y1 - 8, v.z0 + (v.z1 - v.z0) * 0.72, v.z1, mix(col, [0, 0, 0], 0.2));
      cimke(E, { ...v, x1: v.x1 - 2, y0: v.y0 + 2, y1: v.y1 - 2 }, b.stop, oldal, jelolo);
      return;
    }
    if (cs === 'egyeb') {
      E.festett.box(v.x0, v.x1, v.y0, v.y1, v.z0, v.z1, tint || szin(b.color || '#8d78fc'));
      cimke(E, v, b.stop, oldal, jelolo);
      return;
    }
    // Karton (doboz): ragasztószalaggal a tetején és a két homlokoldalán.
    test(v.x0, v.x1, v.y0, v.y1, v.z0, v.z1, 'karton', { uv: 60 });
    const sz = Math.min(5, (hosszX ? v.y1 - v.y0 : v.x1 - v.x0) * 0.12);
    if (hosszX) {
      const c = (v.y0 + v.y1) / 2;
      E.szalag.box(v.x0 - 0.2, v.x1 + 0.2, c - sz / 2, c + sz / 2, v.z1 - 0.1, v.z1 + 0.25, [1, 1, 1], { ao: false });
      E.szalag.box(v.x0 - 0.25, v.x0, c - sz / 2, c + sz / 2, v.z1 - Math.min(12, (v.z1 - v.z0) / 3), v.z1 + 0.2, [1, 1, 1], { ao: false });
      E.szalag.box(v.x1, v.x1 + 0.25, c - sz / 2, c + sz / 2, v.z1 - Math.min(12, (v.z1 - v.z0) / 3), v.z1 + 0.2, [1, 1, 1], { ao: false });
    } else {
      const c = (v.x0 + v.x1) / 2;
      E.szalag.box(c - sz / 2, c + sz / 2, v.y0 - 0.2, v.y1 + 0.2, v.z1 - 0.1, v.z1 + 0.25, [1, 1, 1], { ao: false });
      E.szalag.box(c - sz / 2, c + sz / 2, v.y0 - 0.25, v.y0, v.z1 - Math.min(12, (v.z1 - v.z0) / 3), v.z1 + 0.2, [1, 1, 1], { ao: false });
      E.szalag.box(c - sz / 2, c + sz / 2, v.y1, v.y1 + 0.25, v.z1 - Math.min(12, (v.z1 - v.z0) / 3), v.z1 + 0.2, [1, 1, 1], { ao: false });
    }
    if (v.z1 - v.z0 >= 15 && Math.min(v.x1 - v.x0, v.y1 - v.y0) >= 20) cimke(E, v, b.stop, oldal, jelolo);
  }

  // ------------------------------------------------------------------------------------------------------------
  // Jármű
  // ------------------------------------------------------------------------------------------------------------
  function padloMagassag(t, P) {
    if (Number.isFinite(P.padloMagassagCm)) return P.padloMagassagCm;
    if (P.tipus === 'nyerges') return Math.max(80, Math.min(125, 400 - t.height - 15));
    return t.length < 500 ? 60 : Math.max(85, Math.min(120, 400 - t.height - 15));
  }
  function kerek(E, x, y0, y1, zt, r) {
    const yc = (y0 + y1) / 2, w = y1 - y0;
    E.gumi.henger('y', [x, yc, zt + r], r, w, [1, 1, 1], 32);
    E.felni.henger('y', [x, yc + (y0 < 0 ? -w / 2 - 0.3 : w / 2 + 0.3) * 0, zt + r], r * 0.58, w + 0.8, [1, 1, 1], 24);
  }
  function jarmuEpit(E, t, P, metszetOldal) {
    const L = t.length, W = t.width, H = t.height, dh = padloMagassag(t, P), g = -dh;
    const feher = [0.93, 0.94, 0.95], ezust = [0.75, 0.78, 0.8];
    // Padló és alváz
    E.padlo.box(0, L, 0, W, -12, 0, [1, 1, 1], { uv: 100, ao: false });
    E.alvaz.box(-2, L + 2, -4, 0, -14, 0, [1, 1, 1]); E.alvaz.box(-2, L + 2, W, W + 4, -14, 0, [1, 1, 1]);
    for (const yy of [W * 0.28, W * 0.72]) E.alvaz.box(0, L, yy - 6, yy + 6, Math.max(g + 55, -48), -12, [1, 1, 1]);
    for (let x = 60; x < L; x += 120) E.alvaz.box(x - 3, x + 3, W * 0.2, W * 0.8, -26, -12, [1, 1, 1]);
    // Rögzítőpontok
    for (let x = (P.rogzitoKozCm || 100) / 2; x < L; x += P.rogzitoKozCm || 100) { E.acel.box(x - 4, x + 4, -1, 1.5, -2, 1.2, ezust); E.acel.box(x - 4, x + 4, W - 1.5, W + 1, -2, 1.2, ezust); }
    // Homlokfal
    E.panel.box(-6, 0, -4, W + 4, 0, H + 6, [0.86, 0.88, 0.9], { uv: 100 });
    // Keret: tetősínek, sarokoszlopok, hátsó portál
    for (const yy of [[-4, 0], [W, W + 4]]) E.acel.box(-6, L + 6, yy[0], yy[1], H, H + 6, ezust);
    for (let x = 0; x <= L; x += Math.max(100, L / Math.round(L / 120))) E.acel.box(x - 1.5, x + 1.5, -4, W + 4, H + 4, H + 7, ezust);
    E.panel.box(L, L + 8, -6, 2, -14, H + 6, [0.82, 0.84, 0.86]); E.panel.box(L, L + 8, W - 2, W + 6, -14, H + 6, [0.82, 0.84, 0.86]);
    E.panel.box(L, L + 8, -6, W + 6, H, H + 10, [0.82, 0.84, 0.86]);
    if (P.oldalNyithato) for (let x = 0; x < L; x += 136) if (x > 0) { E.acel.box(x - 2, x + 2, -5, -2, 0, H, ezust); E.acel.box(x - 2, x + 2, W + 2, W + 5, 0, H, ezust); }
    // Nyitott hátsó ajtószárnyak (270°-ban az oldalfalakhoz hajtva)
    E.panel.box(L - W / 2, L + 4, -14, -10, -8, H + 4, feher, { uv: 100 });
    E.panel.box(L - W / 2, L + 4, W + 10, W + 14, -8, H + 4, feher, { uv: 100 });
    // Ütköző, lámpák
    E.alvaz.box(L - 20, L + 6, 10, W - 10, g + 45, g + 58, [1, 1, 1]);
    E.festett.box(L + 4, L + 7, 12, 40, g + 60, g + 72, [0.75, 0.1, 0.1], { ao: false }); E.festett.box(L + 4, L + 7, W - 40, W - 12, g + 60, g + 72, [0.75, 0.1, 0.1], { ao: false });
    // Oldalak (ponyva vagy dobozfal) – metszetnél a kamera felőli oldal elhagyva
    const ol = { bal: () => E.ponyva.box(0, L, -3, -2, 0, H, [1, 1, 1], { uv: 100, ao: false }), jobb: () => E.ponyva.box(0, L, W + 2, W + 3, 0, H, [1, 1, 1], { uv: 100, ao: false }) };
    if (metszetOldal !== 'bal') ol.bal();
    if (metszetOldal !== 'jobb') ol.jobb();
    // Tengelyek, kerekek
    const r = dh < 90 ? 40 : 48, kerekY = [[-2, 34], [W - 34, W + 2]];
    const tengely = (x) => { for (const [a, bb] of kerekY) kerek(E, x, a, bb, g, r); E.alvaz.henger('y', [x, W / 2, g + r], 6, W - 40, [1, 1, 1], 12); };
    if (P.tipus === 'nyerges') {
      for (const d of [-131, 0, 131]) tengely(P.tengelyX + d);
      // Támasztóláb
      for (const yy of [W * 0.2, W * 0.8]) E.alvaz.box(P.kiralycsapX + 110, P.kiralycsapX + 120, yy - 5, yy + 5, g + 8, -14, [1, 1, 1]);
      // Vontató
      const v = P.vontato, xd = P.kiralycsapX + v.nyeregElotolCm, xf = xd - v.tengelytavCm;
      const kg = g;
      E.alvaz.box(xf - 150, xd + 70, W * 0.25, W * 0.75, kg + 50, kg + 85, [1, 1, 1]);
      E.acel.box(P.kiralycsapX - 50, P.kiralycsapX + 50, W * 0.25, W * 0.75, kg + 85, -14, [0.3, 0.3, 0.32]);
      for (const x of [xf, xd]) for (const [a, bb] of [[-2, 30], [W - 30, W + 2]]) kerek(E, x, a, bb, kg, 50);
      const cx0 = xf - 150, cx1 = xf + 95, cz0 = kg + 90, cz1 = kg + 385;
      E.kabin.box(cx0, cx1, -3, W + 3, cz0, cz1, szin('#f1f3f5'), { uv: 100 });
      E.uveg.box(cx0 - 0.6, cx0 + 4, 12, W - 12, cz0 + 150, cz0 + 245, [1, 1, 1], { ao: false });
      for (const yy of [-3.6, W + 3]) E.uveg.box(cx0 + 15, cx0 + 95, yy, yy + 0.6, cz0 + 150, cz0 + 245, [1, 1, 1], { ao: false });
      E.festett.box(cx0 - 2, cx0 + 1, 30, W - 30, cz0 + 20, cz0 + 95, [0.12, 0.13, 0.15], { ao: false });
      E.festett.box(cx0 - 3, cx0 + 2, -3, W + 3, cz0 - 5, cz0 + 18, [0.2, 0.21, 0.23]);
      E.kabin.box(cx0 + 40, cx1 - 10, 10, W - 10, cz1, cz1 + 25, szin('#e8ebee'));
      for (const yy of [W * 0.2, W * 0.8]) E.festett.box(cx0 - 2, cx0 + 1, yy - 15, yy + 15, cz0 + 2, cz0 + 12, [1, 0.95, 0.8], { ao: false });
    } else {
      tengely(P.elsoX); tengely(P.hatsoX);
      if (P.elsoX < 0) {
        const fl = t.length < 500 ? 160 : 210, cx1 = -8, cx0 = cx1 - fl, cz0 = g + 70, cz1 = Math.min(H + 30, cz0 + (t.length < 500 ? 200 : 300));
        E.alvaz.box(cx0 + 20, 0, W * 0.25, W * 0.75, g + 40, -12, [1, 1, 1]);
        E.kabin.box(cx0, cx1, 0, W, cz0, cz1, szin('#f1f3f5'), { uv: 100 });
        E.uveg.box(cx0 - 0.6, cx0 + 3, 10, W - 10, cz0 + (cz1 - cz0) * 0.5, cz0 + (cz1 - cz0) * 0.85, [1, 1, 1], { ao: false });
        E.festett.box(cx0 - 2, cx0 + 1, 25, W - 25, cz0 + 10, cz0 + 60, [0.12, 0.13, 0.15], { ao: false });
      } else {
        E.alvaz.box(-180, 0, W / 2 - 4, W / 2 + 4, g + 50, g + 58, [1, 1, 1]); // vonórúd
      }
    }
    return g;
  }

  // ------------------------------------------------------------------------------------------------------------
  // Stúdiókörnyezet (a three.js RoomEnvironment mintájára, egyszerűsítve)
  // ------------------------------------------------------------------------------------------------------------
  function kornyezet(renderer) {
    const sc = new THREE.Scene();
    const geo = new THREE.BoxGeometry();
    const fal = new THREE.MeshStandardMaterial({ side: THREE.BackSide, color: 0x8a8f99 });
    const szoba = new THREE.Mesh(geo, fal); szoba.scale.set(30, 12, 30); szoba.position.set(0, 5, 0); sc.add(szoba);
    const fenyAnyag = (i) => new THREE.MeshBasicMaterial({ color: new THREE.Color(i, i, i) });
    for (const [x, y, z, sx, sy, sz, i] of [[0, 10.5, 0, 14, 0.2, 10, 3.5], [-12, 6, 0, 0.2, 5, 14, 2.2], [12, 6, 0, 0.2, 5, 14, 1.6], [0, 6, -14, 18, 5, 0.2, 1.4], [0, 6, 14, 18, 5, 0.2, 1.2]]) {
      const m = new THREE.Mesh(geo, fenyAnyag(i)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); sc.add(m);
    }
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(sc, 0.04);
    pm.dispose();
    return rt.texture;
  }

  // ------------------------------------------------------------------------------------------------------------
  // Megjelenítő
  // ------------------------------------------------------------------------------------------------------------
  function tamogatott() {
    try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch { return false; }
  }

  const MINOSEG = {
    alacsony: { pr: 1, arnyek: 0, env: false },
    kozepes: { pr: 1.5, arnyek: 2048, env: true },
    magas: { pr: 2, arnyek: 4096, env: true },
  };

  function letrehoz(tarolo, beall = {}) {
    if (!tamogatott()) return null;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' }); } catch { return null; }
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.physicallyCorrectLights = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const cv = renderer.domElement; cv.className = 'scene3d'; cv.setAttribute('aria-hidden', 'true');
    tarolo.prepend(cv);
    const cimkek = document.createElement('div'); cimkek.className = 'labels3d'; tarolo.append(cimkek);

    const scene = new THREE.Scene();
    const hatter = new THREE.Color('#1a2335');
    scene.background = hatter;
    scene.fog = new THREE.Fog(hatter, 40, 90);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);
    const A = anyagok();
    let envTex = null;
    const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x3a3530, 1.1); scene.add(hemi);
    const nap = new THREE.DirectionalLight(0xfff3e0, 3.2); nap.castShadow = true; scene.add(nap); scene.add(nap.target);
    nap.shadow.bias = -0.0004; nap.shadow.normalBias = 0.02; nap.shadow.radius = 4;
    const tolto = new THREE.DirectionalLight(0xbcd2ff, 0.7); scene.add(tolto);
    const talaj = new THREE.Mesh(new THREE.CircleGeometry(60, 64), A.talaj); talaj.rotation.x = -Math.PI / 2; talaj.receiveShadow = true;
    talaj.material.map.repeat.set(30, 30); scene.add(talaj);

    const csoport = { jarmu: new THREE.Group(), rakomany: new THREE.Group(), atlatszo: new THREE.Group(), fedes: new THREE.Group(), mozgo: new THREE.Group() };
    for (const g of Object.values(csoport)) scene.add(g);
    const kam = { yaw: 0.75, elev: 0.45, zoom: 1, cel: new THREE.Vector3(), tav: 20, anim: null, sajatCel: null };
    let minoseg = 'kozepes', auto = beall.auto !== false, adat = null, jSig = '', rSig = '', fSig = '', metszet = null, foldZ = -1.15;
    let w = 1, h = 1, kellRender = true, frameIdok = [], animalt = false;
    const pickDobozok = [];
    const raycaster = new THREE.Raycaster();

    function minosegBeall(m) {
      minoseg = MINOSEG[m] ? m : 'kozepes';
      const q = MINOSEG[minoseg];
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr));
      renderer.shadowMap.enabled = q.arnyek > 0;
      nap.castShadow = q.arnyek > 0;
      if (q.arnyek) { nap.shadow.mapSize.set(q.arnyek, q.arnyek); if (nap.shadow.map) { nap.shadow.map.dispose(); nap.shadow.map = null; } }
      if (q.env && !envTex) envTex = kornyezet(renderer);
      scene.environment = q.env ? envTex : null;
      for (const mat of Object.values(A)) mat.needsUpdate = true;
      meret(); kellRender = true;
    }
    function meret() {
      w = Math.max(1, tarolo.clientWidth); h = Math.max(1, tarolo.clientHeight);
      renderer.setSize(w, h, false); cv.style.width = w + 'px'; cv.style.height = h + 'px';
      camera.aspect = w / h; camera.updateProjectionMatrix(); kellRender = true;
    }
    function urit(g) { for (const c of [...g.children]) { g.remove(c); if (c.geometry) c.geometry.dispose(); } }
    function epitok() { const E = {}; for (const k of Object.keys(A)) E[k] = new Epito(); return E; }
    function halok(E, cel, opt = {}) {
      for (const [k, e] of Object.entries(E)) {
        const m = e.hal(A[k], { arnyek: !['folia', 'ponyva', 'cimke', 'uveg'].includes(k) && opt.arnyek !== false, sorrend: ['folia', 'ponyva', 'ibc'].includes(k) ? 2 : null });
        if (m) cel.add(m);
      }
    }
    const box3 = (b) => ({ x0: b.x, x1: b.x + (b.rot ? b.width : b.length), y0: b.y, y1: b.y + (b.rot ? b.length : b.width), z0: b.z, z1: b.z + b.height });

    function jarmuFrissit() {
      const t = adat.trailer, P = adat.profil || {};
      const ms = adat.metszet ? metszetOldal() : null;
      const sig = JSON.stringify([t.length, t.width, t.height, P, ms]);
      if (sig === jSig) return; jSig = sig; metszet = ms;
      urit(csoport.jarmu);
      const E = epitok();
      foldZ = jarmuEpit(E, t, P, ms) / 100;
      halok(E, csoport.jarmu);
      talaj.position.set(t.length / 200, foldZ - 0.001, -t.width / 200);
      const L = t.length / 100, W = t.width / 100, H = t.height / 100;
      kam.cel.set(L / 2, H / 2, -W / 2);
      kam.tav = (0.5 * Math.hypot(L + 3, W, H + Math.abs(foldZ))) / Math.sin((camera.fov * Math.PI) / 360) * 0.68;
      const s = Math.max(L, 8);
      nap.position.set(L / 2 + s * 0.45, s * 1.1, -W / 2 + s * 0.6); nap.target.position.set(L / 2, 0, -W / 2);
      const sc = nap.shadow.camera; sc.left = -s * 0.8; sc.right = s * 0.8; sc.top = s * 0.8; sc.bottom = -s * 0.8; sc.near = 0.5; sc.far = s * 4; sc.updateProjectionMatrix();
      tolto.position.set(-s, s * 0.6, s);
    }
    function metszetOldal() {
      // A kamera felőli oldal: a nézési irány y-komponense szerint.
      const ey = Math.cos(kam.yaw) * Math.cos(kam.elev);
      return ey >= 0 ? 'jobb' : 'bal';
    }

    function rakomanyFrissit() {
      const sig = JSON.stringify([adat.boxes.map((b) => [b.id, b.x, b.y, b.z, b.rot, b.length, b.width, b.height, b.csomagolas, b.color, b.stop, b.lerakoOldal]), adat.szinezes, adat.kivett ? [...adat.kivett] : null]);
      if (sig === rSig) return; rSig = sig;
      urit(csoport.rakomany); urit(csoport.atlatszo);
      const E = epitok();
      pickDobozok.length = 0;
      for (const b of adat.boxes) {
        if (adat.kivett && adat.kivett.has(b.id)) continue;
        const v = box3(b);
        pickDobozok.push({ id: b.id, v });
        egysegModell(E, b, v, adat.szinezes || 'valosag', adat.oldal ? adat.oldal(b) : 'hatso');
      }
      halok(E, csoport.rakomany);
    }

    function vonalak(v, szinHex, vastag = 0) {
      const g = new THREE.BoxGeometry((v.x1 - v.x0) / 100 + vastag, (v.z1 - v.z0) / 100 + vastag, (v.y1 - v.y0) / 100 + vastag);
      const e = new THREE.EdgesGeometry(g); g.dispose();
      const l = new THREE.LineSegments(e, new THREE.LineBasicMaterial({ color: szinHex, depthTest: false, transparent: true, opacity: 0.95 }));
      const c = T((v.x0 + v.x1) / 2, (v.y0 + v.y1) / 2, (v.z0 + v.z1) / 2); l.position.set(...c); l.renderOrder = 5;
      return l;
    }
    function fedesFrissit() {
      const sig = JSON.stringify([adat.kijelolt, adat.preview, [...(adat.sertesek || [])], adat.sulypont, adat.rogzites ? [adat.rogzites.pantHelyekX, adat.rogzites.pantDb] : null, adat.hezagok, adat.szabadTerek, adat.aktivTer, adat.ldmCm, rSig.length, adat.mutat, adat.csuszasgatlo]);
      if (sig === fSig) return; fSig = sig;
      for (const c of [...csoport.fedes.children]) { csoport.fedes.remove(c); c.geometry?.dispose(); if (c.material && !Object.values(A).includes(c.material)) c.material.dispose(); }
      const mut = adat.mutat || {};
      const byId = new Map(adat.boxes.map((b) => [b.id, b]));
      if (adat.kijelolt != null && byId.has(adat.kijelolt) && !(adat.kivett && adat.kivett.has(adat.kijelolt))) csoport.fedes.add(vonalak(box3(byId.get(adat.kijelolt)), 0xffe066, 0.012));
      if (mut.sertesek !== false) for (const id of adat.sertesek || []) if (byId.has(id) && id !== adat.kijelolt) csoport.fedes.add(vonalak(box3(byId.get(id)), 0xff4d6d, 0.008));
      if (adat.preview) {
        const v = box3(adat.preview.box), E = new Epito();
        E.box(v.x0, v.x1, v.y0, v.y1, v.z0, v.z1, [1, 1, 1], { ao: false });
        const m = E.hal(adat.preview.ok ? A.szellem : A.szellemRossz, { arnyek: false }); m.renderOrder = 4; csoport.fedes.add(m);
        csoport.fedes.add(vonalak(v, adat.preview.ok ? 0x8fffd0 : 0xff8b98));
      }
      // Rögzítés: pántok, élvédők, légzsákok, csúszásgátló
      if (mut.rogzites !== false && adat.rogzites && adat.rogzites.pantDb > 0) {
        const E = { pant: new Epito(), elvedo: new Epito(), legzsak: new Epito(), gumi: new Epito() };
        const pl = adat.boxes.filter((b) => !(adat.kivett && adat.kivett.has(b.id))).map(box3);
        for (const x of adat.rogzites.pantHelyekX) {
          const szelet = pl.filter((v) => v.x0 <= x && x <= v.x1);
          if (!szelet.length) continue;
          const W = adat.trailer.width;
          // Felső körvonal y mentén
          const pontok = [];
          const ys = [...new Set(szelet.flatMap((v) => [v.y0, v.y1]))].sort((a, b) => a - b);
          const mag = (y) => Math.max(0, ...szelet.filter((v) => v.y0 <= y && y <= v.y1).map((v) => v.z1));
          const yl = ys[0], yr = ys[ys.length - 1];
          pontok.push([x, -1, 1]);
          for (let i = 0; i < ys.length; i++) { const y = ys[i], hh = mag(y); if (i > 0) pontok.push([x, y, Math.max(mag(ys[i - 1] + 0.5), hh)]); pontok.push([x, y, hh]); }
          pontok.push([x, W + 1, 1]);
          const p2 = [pontok[0], [x, yl - 0.6, mag(yl) + 0.6]];
          for (let i = 2; i < pontok.length - 1; i++) p2.push([x, pontok[i][1], pontok[i][2] + 0.6]);
          p2.push([x, yr + 0.6, mag(yr) + 0.6], pontok[pontok.length - 1]);
          for (let i = 0; i + 1 < p2.length; i++) E.pant.szalag(x, p2[i], p2[i + 1], 5, [1, 1, 1]);
          E.elvedo.box(x - 7, x + 7, yl - 1.2, yl + 9, mag(yl) - 0.2, mag(yl) + 1.2, [1, 1, 1]);
          E.elvedo.box(x - 7, x + 7, yr - 9, yr + 1.2, mag(yr) - 0.2, mag(yr) + 1.2, [1, 1, 1]);
          E.elvedo.box(x - 6, x + 6, -1.6, 2, 12, 30, [0.6, 0.6, 0.62]); // racsni
        }
        for (const hz of (adat.hezagok || []).filter((q) => q.cm <= 40)) {
          const i = 1.5;
          if (hz.irany === 'menet') E.legzsak.box(hz.x0 + i, hz.x1 - i, hz.y0 + 6, hz.y1 - 6, hz.z0 + 6, hz.z1 - 6, [1, 1, 1]);
          else E.legzsak.box(hz.x0 + 6, hz.x1 - 6, hz.y0 + i, hz.y1 - i, hz.z0 + 6, hz.z1 - 6, [1, 1, 1]);
        }
        if (adat.csuszasgatlo) for (const v of pl.filter((q) => q.z0 === 0)) for (const [x, y] of [[v.x0 + 2, v.y0 + 2], [v.x1 - 17, v.y0 + 2], [v.x0 + 2, v.y1 - 17], [v.x1 - 17, v.y1 - 17]]) E.gumi.box(x, x + 15, y, y + 15, -0.1, 0.4, [1, 1, 1]);
        for (const [k, e] of Object.entries(E)) { const m = e.hal(A[k]); if (m) csoport.fedes.add(m); }
      }
      // Súlypont
      if (mut.sulypont !== false && adat.sulypont) {
        const s = adat.sulypont, gm = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0x551122, roughness: 0.3, depthTest: false }));
        gm.position.set(...T(s.x, s.y, s.z)); gm.renderOrder = 6; csoport.fedes.add(gm);
        const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...T(s.x, s.y, 0.5)), new THREE.Vector3(...T(s.x, s.y, s.z))]);
        const ln = new THREE.Line(lg, new THREE.LineDashedMaterial({ color: 0xff6680, dashSize: 0.08, gapSize: 0.05, depthTest: false })); ln.computeLineDistances(); ln.renderOrder = 6; csoport.fedes.add(ln);
        const kor = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.22, 32), new THREE.MeshBasicMaterial({ color: 0xff3355, side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: 0.85 }));
        kor.rotation.x = -Math.PI / 2; kor.position.set(...T(s.x, s.y, 0.6)); kor.renderOrder = 6; csoport.fedes.add(kor);
      }
      // Szabad terek
      if (adat.szabadTerek) for (const s of adat.szabadTerek) {
        const E = new Epito(); E.box(s.x0, s.x1, s.y0, s.y1, s.z0, s.z1, [1, 1, 1], { ao: false });
        const m = E.hal(s.azonosito === adat.aktivTer ? A.terAktiv : A.ter, { arnyek: false }); m.renderOrder = 3; csoport.fedes.add(m);
        csoport.fedes.add(vonalak(s, 0x5fe1ff));
      }
      // Fizikai helyigény jelölése
      if (adat.ldmCm > 0) {
        const W = adat.trailer.width;
        const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...T(adat.ldmCm, -8, 0.8)), new THREE.Vector3(...T(adat.ldmCm, W + 8, 0.8))]);
        const ln = new THREE.Line(lg, new THREE.LineDashedMaterial({ color: 0xffd27a, dashSize: 0.12, gapSize: 0.07 })); ln.computeLineDistances(); csoport.fedes.add(ln);
      }
    }

    function cimkeFrissit() {
      const mut = adat.mutat || {}, lista = [];
      if (mut.azonositok) for (const b of adat.boxes) { if (adat.kivett && adat.kivett.has(b.id)) continue; const v = box3(b); lista.push({ p: T((v.x0 + v.x1) / 2, (v.y0 + v.y1) / 2, v.z1 + 4), t: String(b.label || b.id), c: 'id' + (b.id === adat.kijelolt ? ' sel' : '') }); }
      if (mut.sulypont !== false && adat.sulypont) lista.push({ p: T(adat.sulypont.x, adat.sulypont.y, adat.sulypont.z + 22), t: 'Súlypont', c: 'sp' });
      if (mut.meretek && adat.trailer) {
        const t = adat.trailer;
        lista.push({ p: T(t.length / 2, -14, 0), t: `hossz ${t.length} cm`, c: 'dim' }, { p: T(t.length + 12, t.width / 2, 0), t: `szélesség ${t.width} cm`, c: 'dim' }, { p: T(t.length + 12, t.width + 6, t.height / 2), t: `magasság ${t.height} cm`, c: 'dim' });
        if (adat.ldmCm > 0) lista.push({ p: T(adat.ldmCm, -14, 5), t: `Fizikai helyigény ${(adat.ldmCm / 100).toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`, c: 'ldm' });
        const s = adat.boxes.find((q) => q.id === adat.kijelolt);
        if (s) { const v = box3(s); lista.push({ p: T(v.x1, (v.y0 + v.y1) / 2, v.z1 + 14), t: `${v.x1 - v.x0} × ${v.y1 - v.y0} × ${v.z1 - v.z0} cm · X ${v.x0} Y ${v.y0} Z ${v.z0}`, c: 'seldim' }); }
      }
      if (mut.tengelyek && adat.tengelyCimkek) for (const a of adat.tengelyCimkek) lista.push({ p: T(a.x, -20, foldZ * 100 + 10), t: a.t, c: 'axle' + (a.tul ? ' bad' : '') });
      while (cimkek.children.length > lista.length) cimkek.lastChild.remove();
      while (cimkek.children.length < lista.length) cimkek.append(document.createElement('span'));
      const v = new THREE.Vector3();
      lista.forEach((l, i) => {
        const e = cimkek.children[i];
        v.set(...l.p).project(camera);
        if (v.z > 1 || v.z < -1) { e.style.display = 'none'; return; }
        e.style.display = ''; e.className = l.c; if (e.textContent !== l.t) e.textContent = l.t;
        e.style.transform = `translate(${((v.x + 1) / 2) * w}px,${((1 - v.y) / 2) * h}px) translate(-50%,-50%)`;
      });
    }

    function kameraAll(dt) {
      if (kam.anim) {
        const a = kam.anim; a.t = Math.min(1, a.t + dt / a.ido);
        const e = a.t < 0.5 ? 2 * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 2) / 2;
        kam.yaw = a.y0 + (a.y1 - a.y0) * e; kam.elev = a.e0 + (a.e1 - a.e0) * e; kam.zoom = a.z0 + (a.z1 - a.z0) * e;
        kam.sajatCel = a.c0.clone().lerp(a.c1, e);
        if (a.t >= 1) { if (a.alap) kam.sajatCel = null; kam.anim = null; }
      }
      const ex = Math.sin(kam.yaw) * Math.cos(kam.elev), ey = Math.cos(kam.yaw) * Math.cos(kam.elev), ez = Math.sin(kam.elev);
      const cel = kam.sajatCel || kam.cel, d = kam.tav / kam.zoom;
      camera.position.set(cel.x + ex * d, Math.max(foldZ + 0.25, cel.y + ez * d), cel.z - ey * d);
      camera.lookAt(cel);
    }

    let utolso = performance.now(), mozgas = null;
    function render(force) {
      if (!adat) return;
      const most = performance.now(), dt = Math.min(0.1, (most - utolso) / 1000); utolso = most;
      if (adat.metszet && metszetOldal() !== metszet) jarmuFrissit();
      kameraAll(dt);
      if (mozgas) {
        mozgas.t = Math.min(1, mozgas.t + dt / 1.1);
        for (const g of csoport.mozgo.children) { const d = g.userData.irany; g.position.set(d[0] * mozgas.t * mozgas.t, d[1] * mozgas.t * mozgas.t, d[2] * mozgas.t * mozgas.t); }
        if (mozgas.t >= 1) { urit(csoport.mozgo); for (const g of [...csoport.mozgo.children]) csoport.mozgo.remove(g); mozgas = null; }
      }
      const t0 = performance.now();
      renderer.render(scene, camera);
      cimkeFrissit();
      if (auto && (kam.anim || mozgas || force === 'interakcio')) {
        frameIdok.push(performance.now() - t0 + 0);
        if (frameIdok.length > 40) {
          const atl = frameIdok.reduce((a, b) => a + b, 0) / frameIdok.length; frameIdok = [];
          if (atl > 30 && minoseg !== 'alacsony') { minosegBeall(minoseg === 'magas' ? 'kozepes' : 'alacsony'); beall.minosegValtas?.(minoseg); }
        }
      }
      animalt = !!(kam.anim || mozgas);
      if (animalt) requestAnimationFrame(() => render());
    }

    function frissit(d, opt = {}) {
      if (tarolo.clientWidth !== w || tarolo.clientHeight !== h) meret();
      const regiKivett = adat?.kivett ? new Set(adat.kivett) : new Set();
      adat = d;
      if (opt.kamera && !kam.anim) { kam.yaw = opt.kamera.yaw; kam.elev = opt.kamera.elev; kam.zoom = opt.kamera.zoom; }
      jarmuFrissit();
      // Lerakodási animáció: az újonnan kivett egységek kicsúsznak a kivételi oldalon.
      const ujKi = d.kivett ? [...d.kivett].filter((id) => !regiKivett.has(id)) : [];
      if (ujKi.length && opt.animal !== false) {
        urit(csoport.mozgo);
        const csop = {};
        for (const id of ujKi) {
          const b = d.boxes.find((q) => q.id === id); if (!b) continue;
          const old = d.oldal ? d.oldal(b) : 'hatso';
          (csop[old] ||= []).push(b);
        }
        for (const [old, lista] of Object.entries(csop)) {
          const E = epitok();
          for (const b of lista) egysegModell(E, b, box3(b), d.szinezes || 'valosag', old);
          const g = new THREE.Group(); halok(E, g, { arnyek: false });
          const L = d.trailer.length / 100 + 3, W = d.trailer.width / 100 + 2;
          g.userData.irany = old === 'bal' ? [0, 0, W] : old === 'jobb' ? [0, 0, -W] : old === 'felso' ? [0, 4, 0] : [L, 0, 0];
          csoport.mozgo.add(g);
        }
        mozgas = { t: 0 };
      }
      rakomanyFrissit();
      fedesFrissit();
      render(opt.interakcio ? 'interakcio' : undefined);
    }

    // --- Kijelölés, síkmetszés ---
    function sugar(sx, sy) {
      raycaster.setFromCamera(new THREE.Vector2((sx / w) * 2 - 1, -(sy / h) * 2 + 1), camera);
      const o = raycaster.ray.origin, dv = raycaster.ray.direction;
      return { o: [o.x * 100, -o.z * 100, o.y * 100], d: [dv.x, -dv.z, dv.y] };
    }
    function pick(sx, sy, kiveve = null) {
      const r = sugar(sx, sy);
      let best = null, bt = Infinity;
      for (const p of pickDobozok) {
        if (p.id === kiveve) continue;
        let t0 = -Infinity, t1 = Infinity;
        const v = p.v, lo = [v.x0, v.y0, v.z0], hi = [v.x1, v.y1, v.z1];
        let ok = true;
        for (let i = 0; i < 3; i++) {
          if (Math.abs(r.d[i]) < 1e-12) { if (r.o[i] < lo[i] || r.o[i] > hi[i]) { ok = false; break; } continue; }
          let a = (lo[i] - r.o[i]) / r.d[i], b = (hi[i] - r.o[i]) / r.d[i];
          if (a > b) [a, b] = [b, a];
          t0 = Math.max(t0, a); t1 = Math.min(t1, b);
          if (t0 > t1) { ok = false; break; }
        }
        if (ok && t1 > 0 && t0 < bt) { bt = t0; best = p.id; }
      }
      return best;
    }
    function sik(sx, sy, zCm = 0) {
      const r = sugar(sx, sy);
      if (Math.abs(r.d[2]) < 1e-9) return null;
      const t = (zCm - r.o[2]) / r.d[2];
      if (t < 0) return null;
      return { x: r.o[0] + r.d[0] * t, y: r.o[1] + r.d[1] * t };
    }
    function nezet(nev) {
      const t = adat?.trailer; if (!t) return;
      const L = t.length / 100, W = t.width / 100, H = t.height / 100;
      const P = {
        alap: [0.75, 0.45, 1, null], felul: [0, 1.49, 1, null], oldal: [0, 0.05, 1, null], hatul: [Math.PI / 2, 0.08, 1, null],
        ajto: [Math.PI / 2, 0.12, 1, new THREE.Vector3(L * 0.62, Math.min(1.5, H * 0.55), -W / 2)],
        targonca: [Math.PI / 2 + 0.18, 0.04, 1.15, new THREE.Vector3(L * 0.7, 0.75, -W / 2)],
      }[nev];
      if (!P) return;
      const c0 = (kam.sajatCel || kam.cel).clone();
      kam.anim = { t: 0, ido: 0.6, y0: kam.yaw, y1: P[0], e0: kam.elev, e1: P[1], z0: kam.zoom, z1: P[2], c0, c1: P[3] || kam.cel.clone(), alap: !P[3] };
      if (nev === 'ajto') kam.anim.z1 = kam.tav / (L * 0.5 + 3.2);
      if (nev === 'targonca') kam.anim.z1 = kam.tav / (L * 0.45 + 2.2);
      render();
      return { yaw: P[0], elev: P[1], zoom: kam.anim.z1 };
    }
    function kep(szorzo = 2, atlatszo = false) {
      const pr = renderer.getPixelRatio();
      renderer.setPixelRatio(pr * szorzo); renderer.setSize(w, h, false);
      const bg = scene.background, fog = scene.fog;
      if (atlatszo) { scene.background = null; scene.fog = null; talaj.visible = false; renderer.setClearColor(0x000000, 0); }
      kameraAll(0); renderer.render(scene, camera);
      const url = cv.toDataURL('image/png');
      scene.background = bg; scene.fog = fog; talaj.visible = true;
      renderer.setPixelRatio(pr); renderer.setSize(w, h, false); renderer.render(scene, camera);
      return url;
    }
    function lathato(on) { cv.style.display = on ? '' : 'none'; cimkek.style.display = on ? '' : 'none'; if (on) { meret(); render(); } }
    function kameraAllapot() { return { yaw: kam.yaw, elev: kam.elev, zoom: kam.zoom }; }
    function egyeniCelTorol() { kam.sajatCel = null; }

    minosegBeall(beall.minoseg || 'kozepes');
    return {
      frissit, render, pick, sik, nezet, kep, meret, lathato, kameraAllapot, egyeniCelTorol,
      minoseg: (m) => { auto = m === 'auto'; minosegBeall(m === 'auto' ? 'kozepes' : m); render(); },
      aktualisMinoseg: () => minoseg, animal: () => animalt, renderer,
      meretTeszt: () => pickDobozok.map((p) => ({ id: p.id, ...p.v })),
      /** Teljesítménymérés: n képkocka kirajzolása GPU-szinkronnal; átlagos ms / képkocka. */
      meres: (n = 60) => { const gl = renderer.getContext(); kameraAll(0); renderer.render(scene, camera); gl.finish(); const t0 = performance.now(); for (let i = 0; i < n; i++) { kam.yaw += 0.01; kameraAll(0); renderer.render(scene, camera); } gl.finish(); return (performance.now() - t0) / n; },
      /** A kirajzolt rakomány-geometria befoglaló doboza egységenként (cm) – a méretpontossági teszthez. */
      geometriaDoboz: () => { const b = new THREE.Box3().setFromObject(csoport.rakomany); return { x0: b.min.x * 100, x1: b.max.x * 100, y0: -b.max.z * 100, y1: -b.min.z * 100, z0: b.min.y * 100, z1: b.max.y * 100 }; },
    };
  }

  return { tamogatott, letrehoz, STOP_SZINEK, stopSzin, T };
});
