/*
 * Rakománytervező 3D V06 – geometriai motor
 * -----------------------------------------
 * Egységes koordináta- és mértékegységrendszer (egész cm):
 *   origó = homlokfal × bal oldalfal × padló közös sarka
 *   x = hosszirány (homlokfaltól a hátsó ajtó felé), y = szélesség (bal faltól), z = magasság (padlótól)
 *   Egy rakományegység pozíciója a homlokfalhoz, bal falhoz és padlóhoz legközelebbi sarka.
 * Forgatás: rot = 0 (hossz x irányban) vagy 1 (90°, hossz y irányban) a függőleges tengely körül.
 * Ütközés: AABB, szigorú egyenlőtlenséggel – a felületek érintkezése NEM ütközés.
 * Böngészőben: window.Geometria, Node-ban: require('./geometria.js').
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Geometria = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** A forgatott egység x/y/z irányú kiterjedése. */
  function meretek(u, rot = u.rot) {
    return rot ? { l: u.width, w: u.length, h: u.height } : { l: u.length, w: u.width, h: u.height };
  }
  /** Tengelyirányú befoglaló téglatest (AABB). */
  function doboz(u, x = u.x, y = u.y, z = u.z, rot = u.rot) {
    const d = meretek(u, rot);
    return { x0: x, x1: x + d.l, y0: y, y1: y + d.w, z0: z, z1: z + d.h };
  }
  /** Valódi térfogat-átfedés (érintkezésnél false). */
  const atfed = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0 && a.z0 < b.z1 && a.z1 > b.z0;
  /** A felső doboz alapja teljesen az alsó felső lapján belül van (x-y vetületben). */
  const fedi = (felso, also) => felso.x0 >= also.x0 && felso.x1 <= also.x1 && felso.y0 >= also.y0 && felso.y1 <= also.y1;
  /** A doboz a rakodótéren belül van (a falak érintése megengedett). */
  const terbenVan = (v, t) => v.x0 >= 0 && v.y0 >= 0 && v.z0 >= 0 && v.x1 <= t.length && v.y1 <= t.width && v.z1 <= t.height;
  const terfogat = (v) => (v.x1 - v.x0) * (v.y1 - v.y0) * (v.z1 - v.z0);

  /** Megengedett orientációk (0 / 1), amelyekben az egység a rakodótér keresztmetszetébe egyáltalán befér. */
  function orientaciok(u, t) {
    const lista = u.rotatable === false || u.length === u.width ? [0] : [0, 1];
    return lista.filter((r) => { const d = meretek(u, r); return d.l <= t.length && d.w <= t.width && d.h <= t.height; });
  }

  /**
   * Egyenletes rácsos térbeli index az x-y síkon. Nagy elemszámnál az ütközés- és alátámasztás-keresés
   * csak a szomszédos cellák elemeit vizsgálja (O(n²) helyett közel O(n)).
   */
  class TerIndex {
    constructor(cella = 50) { this.c = cella; this.cellak = new Map(); this.elemek = new Map(); }
    *_kulcsok(v) {
      const c = this.c;
      for (let i = Math.floor(v.x0 / c), i1 = Math.floor((v.x1 - 1) / c); i <= i1; i++)
        for (let j = Math.floor(v.y0 / c), j1 = Math.floor((v.y1 - 1) / c); j <= j1; j++) yield i + ',' + j;
    }
    hozzaad(id, v, adat) {
      this.elemek.set(id, { id, v, adat });
      for (const k of this._kulcsok(v)) { let s = this.cellak.get(k); if (!s) this.cellak.set(k, (s = [])); s.push(id); }
    }
    torol(id) {
      const e = this.elemek.get(id); if (!e) return;
      for (const k of this._kulcsok(e.v)) { const s = this.cellak.get(k); if (s) { const i = s.indexOf(id); if (i >= 0) s.splice(i, 1); } }
      this.elemek.delete(id);
    }
    /** A v x-y vetületét érintő/átfedő elemek (duplikátum nélkül). */
    jeloltek(v) {
      const lattuk = new Set(), out = [];
      const k0 = { x0: v.x0, x1: Math.max(v.x1, v.x0 + 1), y0: v.y0, y1: Math.max(v.y1, v.y0 + 1) };
      for (const k of this._kulcsok(k0)) {
        const s = this.cellak.get(k); if (!s) continue;
        for (const id of s) if (!lattuk.has(id)) { lattuk.add(id); out.push(this.elemek.get(id)); }
      }
      return out;
    }
    utkozik(v, kiveve = null) {
      for (const e of this.jeloltek(v)) if (e.id !== kiveve && atfed(v, e.v)) return e;
      return null;
    }
    /** Az az elem, amelynek felső lapja pontosan v alján van, és v alapját teljesen lefedi. */
    alatamaszto(v, kiveve = null) {
      for (const e of this.jeloltek(v)) if (e.id !== kiveve && e.v.z1 === v.z0 && fedi(v, e.v)) return e;
      return null;
    }
  }

  // --- Illesztés (snap) ---------------------------------------------------------------------------------------
  /** Rácsra illesztés a homlokfaltól / bal faltól mérve. lepes = 1, 5 vagy 10 cm. */
  const racsra = (v, lepes = 1) => Math.round(v / lepes) * lepes;
  /** A küszöbön belüli legközelebbi illesztési pozíció (ha van), különben az eredeti érték. */
  function magnes(v, jeloltek, kuszob) {
    let legjobb = v, d = kuszob + 1e-9;
    for (const a of jeloltek) { const e = Math.abs(v - a); if (e < d) { d = e; legjobb = a; } }
    return legjobb;
  }
  /**
   * Egy egység illesztett padló-/síkpozíciója.
   * @param {number} x0,y0  kívánt bal-első sarok (cm, lehet tört)
   * @param {{l,w}} d        a forgatott alapméret
   * @param {object} t       rakodótér {length,width}
   * @param {object[]} tobbi a többi elhelyezett egység AABB-je
   * @param {{lepes:number, magnes:boolean, kuszob:number}} beall
   */
  function illeszt(x0, y0, d, t, tobbi, beall = {}) {
    const lepes = beall.lepes || 1, kuszob = beall.kuszob ?? 10;
    let x = racsra(x0, lepes), y = racsra(y0, lepes);
    if (beall.magnes !== false) {
      const xs = [0, t.length - d.l], ys = [0, t.width - d.w];
      for (const o of tobbi) { xs.push(o.x1, o.x0 - d.l); ys.push(o.y1, o.y0 - d.w); }
      x = magnes(x, xs, kuszob); y = magnes(y, ys, kuszob);
    }
    return { x: Math.round(x), y: Math.round(y) };
  }

  return { meretek, doboz, atfed, fedi, terbenVan, terfogat, orientaciok, TerIndex, racsra, magnes, illeszt };
});
