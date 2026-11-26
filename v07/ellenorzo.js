/*
 * Rakománytervező 3D V06/V07 – halmozási szabályok és egységes érvényesség-ellenőrzés
 * -------------------------------------------------------------------------------
 * A kézi mozgatás, az optimalizáló és a betöltés is ezt használja.
 * Alap: a V05 ldm_modul.ellenoriz (ütközés, határ, teljes alátámasztás, réteg, ráterhelés, teherbírás),
 * erre épülnek a V06 szabályai (halmozási mód, oszlopszint, forgathatóság, lerakodási sorrend).
 *
 * Halmozási mód (stackMode):
 *   'nem'   – Nem halmozható: semmi sem kerülhet rá, és ő maga csak a padlón állhat.
 *   'semmi' – Semmi nem helyezhető a tetejére: ő állhat más egységen (ha az alsó engedi), de rá semmi.
 *   'szint' – Legfeljebb maxLayers szintes oszlopban állhat (a legalsó egységet is beleszámítva).
 * Egy oszlopban minden egység szintkorlátja teljesül (a legszigorúbb dönt).
 * Ismeretlen ráterhelés (maxLoadKg = null): az optimalizáló nem tesz rá semmit; kézzel csak figyelmeztetéssel,
 * ekkor a terv állapota „Nem ellenőrzött”.
 * A geometriai ellenőrzés NEM rakományrögzítési vagy közlekedésbiztonsági minősítés.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./ldm_modul.js'));
  else root.Ellenorzo = factory(root.LDMModul);
})(typeof self !== 'undefined' ? self : this, function (LDM) {
  'use strict';

  const MODOK = Object.freeze({ nem: 'Nem halmozható', semmi: 'Semmi nem helyezhető a tetejére', szint: 'Szintkorlátos halmozás' });
  const ALLAPOT = Object.freeze({
    ERVENYES: 'Érvényes', FIGYELMEZTETES: 'Érvényes figyelmeztetésekkel', NEM_ELLENORZOTT: 'Nem ellenőrzött',
    ERVENYTELEN: 'Érvénytelen', RESZLEGES: 'Részleges',
  });
  /** Hibakódok (V05 kódok + V06 új kódok) magyar leírással – dokumentációhoz és a felülethez. */
  const KODOK = Object.freeze({
    ADAT: 'Hibás vagy hiányzó bemeneti adat', HATAR: 'Kilóg a rakodótérből (padló, falak, tető, ajtósík)',
    UTKOZES: 'Két egység térfogata átfed', ALATAMASZTAS: 'Nincs teljes alapterületű alátámasztás',
    NEM_HALMOZHATO: 'Tiltott halmozás: az alsó egységre semmi sem tehető', FELSO_TILTOTT: 'Nem halmozható egység nem állhat más egységen',
    RETEG: 'Rétegszám-túllépés (V05-szabály)', OSZLOP_SZINT: 'Oszlop szintszáma meghaladja egy tagja korlátját',
    TERHELES: 'A felső terhelhetőség túllépése', TEHERBIRAS: 'A jármű hasznos terhének túllépése',
    FORGATAS_TILTOTT: 'Nem forgatható egység elforgatva', LERAKO_SORREND: 'A lerakodási sorrendet akadályozó elhelyezés',
    NEM_IGAZOLT_TERHELES: 'Halmozás ismeretlen terhelhetőségű egységen (nem ellenőrzött)', NINCS_ELHELYEZVE: 'Nincs minden egység elhelyezve',
    ELSO_HEZAG: 'Hézag a homlokfalnál', KERESZT_HEZAG: 'Teljes szélességű üres sáv', URES: 'Üres terv',
    NEM_FER_BE: 'Semmilyen megengedett orientációban nem fér be', HASZNOS_TEHER_TULLEPES: 'A hasznos teher miatt nem fér bele',
    NINCS_SZABAD_HELY: 'Nem talált érvényes szabad helyet',
  });

  /** Halmozási mód kiolvasása (V05-adatból is: stackable=false → 'semmi', ahogy a V05 kezelte). */
  function mod(u) {
    if (u.stackMode === 'nem' || u.stackMode === 'semmi' || u.stackMode === 'szint') return u.stackMode;
    return u.stackable === false ? 'semmi' : 'szint';
  }
  /** Az egység saját oszlop-szintkorlátja. */
  const szintKorlat = (u) => (mod(u) === 'szint' ? u.maxLayers : mod(u) === 'nem' ? 1 : Infinity);
  /** Ráhelyezhető-e más egység. */
  const raTeheto = (u) => mod(u) === 'szint';
  /** Állhat-e más egység tetején. */
  const felulreTeheto = (u) => mod(u) !== 'nem';

  /** V06 egység → V05-kompatibilis mezők (az ldm_modul ezekkel számol). Az eredeti objektum nem változik. */
  function normalizal(u) {
    const m = mod(u);
    return {
      ...u,
      stackMode: m,
      stackable: m === 'szint',
      maxLayers: m === 'szint' ? u.maxLayers : 1,
      maxLoadKg: u.maxLoadKg === undefined ? null : u.maxLoadKg,
      rotatable: u.rotatable !== false,
      stop: Number.isInteger(u.stop) && u.stop > 0 ? u.stop : null,
      rot: u.rot ? 1 : 0,
      x: u.x | 0, y: u.y | 0, z: u.z | 0,
    };
  }

  const yAtfed = (a, b) => a.y0 < b.y1 && a.y1 > b.y0;

  /**
   * Teljes ellenőrzés.
   * @param {{trailer:object, boxes:object[]}} terv  egész cm, homlokfaltól mért koordináták
   * @param {{sorrend?:boolean}} beall  sorrend=true: a lerakodási sorrend megsértése hiba (C terv), különben figyelmeztetés
   * @returns {{ok, hibak, figyelmeztetesek, allapot, tamasz, terheles, reteg, szint, oszlop}}
   */
  function ellenoriz(terv, beall = {}) {
    const boxes = terv.boxes.map(normalizal);
    let r = LDM.ellenoriz(terv.trailer, boxes);
    // V07: több alsó egységen átívelő alátámasztás (beall.tobbTamasz = { arany(u) → 0..1 }). Nélküle a V06-szabály marad.
    if (beall.tobbTamasz && !r.hibak.some((h) => h.kod === 'ADAT')) r = tobbTamaszos(r, boxes, beall.tobbTamasz);
    const hibak = r.hibak.slice(), figy = r.figyelmeztetesek.slice();
    const add = (lista, kod, szoveg, dobozok = []) => lista.push({ kod, szoveg, dobozok });
    const nev = (b) => (b.label ? `${b.label} (#${b.id})` : `${b.id}. doboz`);
    const szint = new Map(), oszlop = new Map();
    if (!hibak.some((h) => h.kod === 'ADAT')) {
      const placed = boxes.filter((b) => b.placed);
      for (const b of placed) {
        if (!b.rotatable && b.rot === 1) add(hibak, 'FORGATAS_TILTOTT', `${nev(b)} nem forgatható, mégis 90°-ban áll.`, [b.id]);
        if (mod(b) === 'nem' && b.z > 0) add(hibak, 'FELSO_TILTOTT', `${nev(b)} nem halmozható, ezért csak a padlón állhat.`, [b.id]);
      }
      // Szint a padlótól (1 = padlón) és az oszlop teljes szintszáma az egységen keresztül.
      if (r.szint) for (const [k, v] of r.szint) szint.set(k, v);
      const szintje = (id, seen = new Set()) => {
        if (szint.has(id)) return szint.get(id);
        if (seen.has(id)) return 1;
        seen.add(id);
        const v = r.tamasz.has(id) ? szintje(r.tamasz.get(id), seen) + 1 : 1;
        szint.set(id, v); return v;
      };
      for (const b of placed) szintje(b.id);
      for (const b of placed) {
        const o = szint.get(b.id) + (r.reteg.get(b.id) || 1) - 1;
        oszlop.set(b.id, o);
        const k = szintKorlat(b);
        if (o > k && mod(b) === 'szint') add(hibak, 'OSZLOP_SZINT', `${nev(b)} legfeljebb ${k} szintes oszlopban állhat, ez az oszlop ${o} szintes.`, [b.id]);
      }
      // Lerakodási sorrend: 1. lerakóhely = elsőként lerakva → az ajtóhoz legközelebb.
      // q (később lerakott, nagyobb sorszám) nem lehet p tetején, és nem lehet p és az ajtó között (azonos y-sávban).
      const stops = placed.filter((b) => b.stop !== null);
      if (stops.length) {
        const lista = beall.sorrend ? hibak : figy;
        const V = new Map(placed.map((b) => [b.id, LDM.box3(b)]));
        for (const p of stops) for (const q of stops) {
          if (q.stop <= p.stop) continue;
          let felul = false, c = q.id;
          while (r.tamasz.has(c)) { c = r.tamasz.get(c); if (c === p.id) { felul = true; break; } }
          const vp = V.get(p.id), vq = V.get(q.id);
          if (felul) add(lista, 'LERAKO_SORREND', `${nev(q)} (${q.stop}. lerakó) ${nev(p)} (${p.stop}. lerakó) tetején áll.`, [p.id, q.id]);
          else if (vq.x0 >= vp.x1 && yAtfed(vp, vq)) add(lista, 'LERAKO_SORREND', `${nev(q)} (${q.stop}. lerakó) az ajtó felől elzárja ${nev(p)}-t (${p.stop}. lerakó).`, [p.id, q.id]);
        }
      }
    }
    const teljes = boxes.length > 0 && boxes.every((b) => b.placed);
    const allapot = hibak.length ? ALLAPOT.ERVENYTELEN
      : !teljes ? ALLAPOT.RESZLEGES
        : figy.some((f) => f.kod === 'NEM_IGAZOLT_TERHELES') ? ALLAPOT.NEM_ELLENORZOTT
          : figy.length ? ALLAPOT.FIGYELMEZTETES : ALLAPOT.ERVENYES;
    return { ok: hibak.length === 0, hibak, figyelmeztetesek: figy, allapot, teljes, tamasz: r.tamasz, tamaszok: r.tamaszok || null, terheles: r.terheles, reteg: r.reteg, szint, oszlop };
  }

  const atfedTerulet = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

  /**
   * V07: alátámasztás több alsó egységen. Egy egység akkor alátámasztott, ha
   *  - az alatta (pontosan az alján) lévő felső lapok együttes érintkezési területe ≥ arany(u) × alapterület, és
   *  - az alapja nem lóg túl az alátámasztó felületek befoglaló téglalapján.
   * A ráterhelés az érintkezési területek arányában oszlik meg. Az LDM-modul ALATAMASZTAS / NEM_HALMOZHATO / RETEG /
   * TERHELES / NEM_IGAZOLT_TERHELES eredményét ez a számítás váltja ki; minden más (határ, ütközés, teherbírás) marad.
   */
  function tobbTamaszos(r, boxes, beall) {
    const KI = new Set(['ALATAMASZTAS', 'NEM_HALMOZHATO', 'RETEG', 'TERHELES']);
    const hibak = r.hibak.filter((h) => !KI.has(h.kod)), figy = r.figyelmeztetesek.filter((f) => f.kod !== 'NEM_IGAZOLT_TERHELES');
    const add = (lista, kod, szoveg, dobozok = []) => lista.push({ kod, szoveg, dobozok });
    const nev = (b) => (b.label ? `${b.label} (#${b.id})` : `${b.id}. doboz`);
    const hu = (n) => Number(n).toLocaleString('hu-HU', { maximumFractionDigits: 0 });
    const placed = boxes.filter((b) => b.placed), V = new Map(placed.map((b) => [b.id, LDM.box3(b)]));
    const tamaszok = new Map(), tamasz = new Map(), gyerekek = new Map(placed.map((b) => [b.id, []]));
    for (const b of placed) {
      const v = V.get(b.id);
      if (v.z0 === 0) continue;
      const alap = (v.x1 - v.x0) * (v.y1 - v.y0);
      const lista = [];
      for (const o of placed) {
        if (o.id === b.id) continue;
        const w = V.get(o.id);
        if (w.z1 !== v.z0) continue;
        const ter = atfedTerulet(v, w);
        if (ter > 0) lista.push({ id: o.id, terulet: ter });
      }
      const ossz = lista.reduce((s, a) => s + a.terulet, 0);
      const arany = Math.min(1, Math.max(0, typeof beall.arany === 'function' ? beall.arany(b) : 1));
      let bx = null;
      for (const a of lista) { const w = V.get(a.id); bx = bx ? { x0: Math.min(bx.x0, w.x0), x1: Math.max(bx.x1, w.x1), y0: Math.min(bx.y0, w.y0), y1: Math.max(bx.y1, w.y1) } : { ...w }; }
      const tullog = !bx || v.x0 < bx.x0 || v.x1 > bx.x1 || v.y0 < bx.y0 || v.y1 > bx.y1;
      if (!lista.length || ossz + 1e-9 < arany * alap || tullog) {
        add(hibak, 'ALATAMASZTAS', `${nev(b)} alatt az alátámasztás ${alap ? Math.round((ossz / alap) * 100) : 0}%${tullog && lista.length ? ', és túllóg az alátámasztó felületen' : ''} (szükséges: legalább ${Math.round(arany * 100)}%, túllógás nélkül).`, [b.id]);
        continue;
      }
      for (const a of lista) {
        a.arany = a.terulet / ossz;
        const o = boxes.find((q) => q.id === a.id);
        if (!o.stackable) add(hibak, 'NEM_HALMOZHATO', `${nev(o)} nem halmozható, mégis ${nev(b)} áll rajta.`, [o.id, b.id]);
        gyerekek.get(a.id).push({ id: b.id, arany: a.arany });
      }
      tamaszok.set(b.id, lista);
      tamasz.set(b.id, lista.slice().sort((p, q) => q.terulet - p.terulet || p.id - q.id)[0].id);
    }
    // Ráterhelés felülről lefelé, szint alulról felfelé, réteg (önmaga + a fölötte lévő leghosszabb lánc) felülről lefelé.
    const byId = new Map(placed.map((b) => [b.id, b]));
    const fel = placed.slice().sort((a, b) => V.get(b.id).z0 - V.get(a.id).z0);
    const terheles = new Map(), reteg = new Map(), szint = new Map();
    for (const b of fel) {
      let t = 0, rr = 1;
      for (const g of gyerekek.get(b.id)) { t += (byId.get(g.id).weight + (terheles.get(g.id) || 0)) * g.arany; rr = Math.max(rr, (reteg.get(g.id) || 1) + 1); }
      if (t > 0) terheles.set(b.id, t);
      if (rr > 1) reteg.set(b.id, rr);
    }
    for (const b of fel.slice().reverse()) {
      const l = tamaszok.get(b.id);
      szint.set(b.id, l ? 1 + Math.max(...l.map((a) => szint.get(a.id) || 1)) : 1);
    }
    for (const b of placed) {
      const rr = reteg.get(b.id) || 1, t = terheles.get(b.id) || 0;
      if (rr > b.maxLayers) add(hibak, 'RETEG', `${nev(b)}: ${rr} réteg, a megengedett ${b.maxLayers}.`, [b.id]);
      if (b.maxLoadKg === null) { if (t > 0) add(figy, 'NEM_IGAZOLT_TERHELES', `${nev(b)}: ${hu(t)} kg áll rajta, de a megengedett ráterhelés nincs megadva – nem igazolt.`, [b.id]); }
      else if (t > b.maxLoadKg + 1e-6) add(hibak, 'TERHELES', `${nev(b)}: a ráhelyezett ${hu(t)} kg meghaladja a megengedett ${hu(b.maxLoadKg)} kg-ot.`, [b.id]);
    }
    return { ...r, ok: hibak.length === 0, hibak, figyelmeztetesek: figy, tamasz, tamaszok, terheles, reteg, szint };
  }

  /**
   * Kézi elhelyezés ellenőrzése: minden geometriai és halmozási hiba blokkol,
   * a hasznos teher túllépése nem (azt az elemzés hibaként mutatja, a V05-tel azonosan).
   */
  function keziEllenoriz(terv) {
    const e = ellenoriz(terv);
    const blokkolo = e.hibak.filter((h) => h.kod !== 'TEHERBIRAS');
    return { ...e, ok: blokkolo.length === 0, blokkolo, reason: blokkolo.length ? blokkolo[0].szoveg : 'Az elrendezés megfelel a beállított geometriai és halmozási szabályoknak.' };
  }

  return { MODOK, ALLAPOT, KODOK, mod, szintKorlat, raTeheto, felulreTeheto, normalizal, ellenoriz, keziEllenoriz };
});
