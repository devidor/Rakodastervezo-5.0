/*
 * Rakománytervező 3D V06 – 2D merőleges nézetek (felül-, oldal-, hátulnézet) méretvonalakkal.
 * Bemenet: egész cm-es, homlokfaltól mért terv. Csak böngészőben (Canvas 2D).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Rajz2D = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const fmt = (n, d = 2) => Number(n).toLocaleString('hu-HU', { minimumFractionDigits: d, maximumFractionDigits: d });
  const NEZETEK = {
    felul: { cim: 'Felülnézet (2D)', a: 'x', b: 'y', fl: false, sor: (v) => v.z1 },
    oldal: { cim: 'Oldalnézet (bal oldalról)', a: 'x', b: 'z', fl: true, sor: (v) => -v.y0 },
    hatul: { cim: 'Hátulnézet (ajtó felől)', a: 'y', b: 'z', fl: true, sor: (v) => v.x1 },
  };
  const vilagosSzin = (hex) => { const c = hex.replace('#', ''); const [r, g, bl] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)); return 0.299 * r + 0.587 * g + 0.114 * bl > 140; };
  const meret = (u) => (u.rot ? [u.width, u.length] : [u.length, u.width]);
  const aabb = (u) => { const [l, w] = meret(u); return { x0: u.x, x1: u.x + l, y0: u.y, y1: u.y + w, z0: u.z, z1: u.z + u.height }; };

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w,h  rajzterület px-ben
   * @param {{trailer, boxes}} terv
   * @param {'felul'|'oldal'|'hatul'} nezet
   * @param {{vilagos?:boolean, kijelolt?:number, azonositok?:boolean, meretvonal?:boolean, terek?:object[], cim?:boolean}} o
   */
  function rajzol(ctx, w, h, terv, nezet, o = {}) {
    const N = NEZETEK[nezet], t = terv.trailer;
    const hossz = { x: t.length, y: t.width, z: t.height };
    const A = hossz[N.a], B = hossz[N.b];
    const c = o.vilagos ? { bg: '#ffffff', ink: '#1b2238', muted: '#5a6788', fal: '#3f4d6e', padlo: '#eef2fa', ldm: '#b7791f', ter: 'rgba(0,160,200,.16)', terv: '#0aa0c8' }
      : { bg: '#0f182c', ink: '#e7ecff', muted: '#9aabca', fal: '#afc8ed', padlo: '#1a2640', ldm: '#ffd27a', ter: 'rgba(64,214,255,.14)', terv: '#5fe1ff' };
    ctx.save();
    ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
    const m = { l: 56, r: 22, t: o.cim === false ? 18 : 34, b: 46 };
    const s = Math.min((w - m.l - m.r) / A, (h - m.t - m.b) / B);
    const ox = m.l, oy = m.t;
    const P = (a, b) => [ox + a * s, N.fl ? oy + (B - b) * s : oy + b * s];
    const rect = (a0, a1, b0, b1) => { const [x0, y0] = P(a0, N.fl ? b1 : b0); return [x0, y0, (a1 - a0) * s, (b1 - b0) * s]; };
    if (o.cim !== false) { ctx.fillStyle = c.ink; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(N.cim, m.l, 20); }
    ctx.fillStyle = c.padlo; ctx.fillRect(...rect(0, A, 0, B));
    // Szabad terek
    for (const sp of o.terek || []) {
      const r = rect(sp[N.a + '0'], sp[N.a + '1'], sp[N.b + '0'], sp[N.b + '1']);
      ctx.fillStyle = c.ter; ctx.fillRect(...r); ctx.strokeStyle = c.terv; ctx.setLineDash([4, 3]); ctx.lineWidth = 1; ctx.strokeRect(...r); ctx.setLineDash([]);
    }
    const placed = terv.boxes.filter((u) => u.placed).map((u) => ({ u, v: aabb(u) })).sort((p, q) => N.sor(p.v) - N.sor(q.v));
    ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const { u, v } of placed) {
      const r = rect(v[N.a + '0'], v[N.a + '1'], v[N.b + '0'], v[N.b + '1']);
      ctx.fillStyle = u.color || '#8d78fc'; ctx.globalAlpha = 0.9; ctx.fillRect(...r); ctx.globalAlpha = 1;
      ctx.strokeStyle = u.id === o.kijelolt ? '#ff3d8b' : (o.vilagos ? '#1b2238' : '#0b1222'); ctx.lineWidth = u.id === o.kijelolt ? 2.5 : 1; ctx.strokeRect(...r);
      if (o.azonositok !== false && r[2] > 16 && r[3] > 11) {
        ctx.fillStyle = vilagosSzin(u.color || '#8d78fc') ? '#0b1222' : '#ffffff';
        const txt = String(u.label || u.id);
        ctx.fillText(ctx.measureText(txt).width < r[2] - 4 ? txt : String(u.id), r[0] + r[2] / 2, r[1] + r[3] / 2);
      }
    }
    ctx.textBaseline = 'alphabetic';
    ctx.strokeStyle = c.fal; ctx.lineWidth = 2; ctx.strokeRect(...rect(0, A, 0, B));
    if (o.meretvonal !== false) {
      ctx.fillStyle = c.muted; ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.font = '11px system-ui, sans-serif';
      const [ax0, ay] = P(0, N.fl ? 0 : B), [ax1] = P(A, 0), yb = ay + 18;
      ctx.beginPath(); ctx.moveTo(ax0, yb); ctx.lineTo(ax1, yb); ctx.moveTo(ax0, yb - 4); ctx.lineTo(ax0, yb + 4); ctx.moveTo(ax1, yb - 4); ctx.lineTo(ax1, yb + 4); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillText(`${A} cm`, (ax0 + ax1) / 2, yb + 14);
      const [, by0] = P(0, 0), [, by1] = P(0, B), xb = ox - 16;
      ctx.beginPath(); ctx.moveTo(xb, by0); ctx.lineTo(xb, by1); ctx.stroke();
      ctx.save(); ctx.translate(xb - 6, (by0 + by1) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(`${B} cm`, 0, 0); ctx.restore();
      if (N.a === 'x' && placed.length) {
        const maxX = Math.max(...placed.map((p) => p.v.x1));
        const [lx, ly0] = P(maxX, 0), [, ly1] = P(maxX, B);
        ctx.strokeStyle = c.ldm; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(lx, ly0); ctx.lineTo(lx, ly1); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = c.ldm; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = lx > w - 150 ? 'right' : 'left';
        ctx.fillText(`Fizikai helyigény ${fmt(maxX / 100)} m`, lx + (lx > w - 150 ? -6 : 6), Math.min(ly0, ly1) - 6 < 12 ? Math.max(ly0, ly1) + 30 : Math.min(ly0, ly1) - 6);
      }
      if (N.a === 'x') { ctx.fillStyle = c.muted; ctx.textAlign = 'left'; ctx.font = '10px system-ui, sans-serif'; ctx.fillText('◀ homlokfal', ox, h - 6); ctx.textAlign = 'right'; ctx.fillText('ajtó ▶', ox + A * s, h - 6); }
    }
    ctx.restore();
  }
  return { NEZETEK, rajzol };
});
