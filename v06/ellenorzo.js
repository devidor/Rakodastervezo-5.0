/*
 * Rakománytervező 3D V06 – halmozási szabályok és egységes érvényesség-ellenőrzés
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
    const r = LDM.ellenoriz(terv.trailer, boxes);
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
    return { ok: hibak.length === 0, hibak, figyelmeztetesek: figy, allapot, teljes, tamasz: r.tamasz, terheles: r.terheles, reteg: r.reteg, szint, oszlop };
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
