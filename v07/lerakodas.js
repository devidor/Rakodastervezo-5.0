/*
 * Rakománytervező 3D V07 – lerakodási hozzáférhetőség, sorrend, időbecslés
 * -----------------------------------------------------------------------
 * Lerakóhely (stop): 1 = elsőként lerakott. A megállóhely nélküli egységek a legutolsó lerakó után következnek.
 * Lerakodási oldal: 'hatso' (hátsó ajtó, x = L felé), 'bal' (y = 0 felé), 'jobb' (y = W felé), 'felso' (darus, felfelé).
 *
 * Átrakás nélküli szabály (kemény): az s. lerakó minden egysége kivehető anélkül, hogy egy későbbi (s' > s) lerakó
 * egységét meg kellene mozdítani. Egy q egység akkor akadályozza p-t, ha
 *   - q (közvetve is) p tetején áll, vagy
 *   - q belelóg p kivételi folyosójába: p alapjától a kivételi oldalig söpört térrész, a kezelési ráhagyással
 *     (targoncánál emelési ráhagyás felfelé) együtt.
 * A lerakodási sorrend topologikus: egy egység csak akkor vehető ki, ha semmi nincs rajta és a folyosója szabad.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./jarmu.js'));
  else root.Lerakodas = factory(root.Jarmu);
})(typeof self !== 'undefined' ? self : this, function (J) {
  'use strict';

  const OLDALAK = Object.freeze({ hatso: 'hátsó ajtó', bal: 'bal oldal (függöny)', jobb: 'jobb oldal (függöny)', felso: 'felülről (daru)' });
  const KEZELES = Object.freeze({ targonca: 'targonca', beka: 'béka (kézi raklapemelő)', kezi: 'kézi', daru: 'daru' });
  const atfed = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0 && a.z0 < b.z1 && a.z1 > b.z0;
  const nev = (b) => (b.label ? `${b.label} (#${b.id})` : `${b.id}. doboz`);

  /** Az egység lerakodási oldala: saját beállítás, a lerakó beállítása, különben hátsó ajtó. */
  const oldal = (u, cfg = {}) => (OLDALAK[u.lerakoOldal] ? u.lerakoOldal : OLDALAK[cfg.stopOldal?.[u.stop]] ? cfg.stopOldal[u.stop] : 'hatso');
  const kezeles = (u) => (KEZELES[u.kezeles] ? u.kezeles : 'kezi');

  /** Kivételi folyosó (AABB, cm). */
  function folyoso(v, old, t, rahagyas, emeles) {
    const H = t.height;
    if (old === 'bal') return { x0: v.x0 - rahagyas, x1: v.x1 + rahagyas, y0: 0, y1: v.y0, z0: v.z0, z1: Math.min(H, v.z1 + emeles) };
    if (old === 'jobb') return { x0: v.x0 - rahagyas, x1: v.x1 + rahagyas, y0: v.y1, y1: t.width, z0: v.z0, z1: Math.min(H, v.z1 + emeles) };
    if (old === 'felso') return { x0: v.x0, x1: v.x1, y0: v.y0, y1: v.y1, z0: v.z1, z1: Math.max(H, v.z1) + 1 };
    return { x0: v.x1, x1: t.length, y0: v.y0 - rahagyas, y1: v.y1 + rahagyas, z0: v.z0, z1: Math.min(H, v.z1 + emeles) };
  }
  const emelesCm = (u, cfg) => (['targonca', 'beka'].includes(kezeles(u)) ? cfg.kezelesRahagyasCm ?? 10 : 2);

  /**
   * Villairány: targoncás / békás egységnél a villa a kivétel irányából kell, hogy beférjen.
   * 'hossz' = a villa az egység hosszával párhuzamos (a rövid oldalán vehető fel), 'szel' = a szélességével párhuzamos.
   * Hátsó ajtónál a villa x irányú, oldalsónál y irányú. Visszaad: megfelel-e.
   */
  function villaOk(u, old) {
    if (!['targonca', 'beka'].includes(kezeles(u)) || !u.villairany || u.villairany === 'mindket' || old === 'felso' || u.billentve) return true;
    const hosszX = !u.rot; // a hossz x irányban áll
    const villaX = old === 'hatso';
    const hosszalParhuzamos = villaX ? hosszX : !hosszX;
    return u.villairany === 'hossz' ? hosszalParhuzamos : !hosszalParhuzamos;
  }

  /** Effektív lerakósorszám: a megálló nélküliek a legutolsó után. */
  function stopok(boxes) {
    const s = boxes.filter((b) => Number.isInteger(b.stop) && b.stop > 0).map((b) => b.stop);
    const max = s.length ? Math.max(...s) : 1;
    return { van: s.length > 0, eff: (b) => (Number.isInteger(b.stop) && b.stop > 0 ? b.stop : max + 1), max };
  }

  /**
   * Elemzés.
   * @param {object} t        rakodótér {length,width,height,...}
   * @param {object[]} placed elhelyezett, normalizált egységek (cm, homlokfaltól)
   * @param {Map} V           id → AABB
   * @param {Map} tamaszok    id → [{id, arany}] (felső → alsók)
   * @param {object} cfg      beállítások (biztonsag.ALAP)
   */
  function elemez(t, placed, V, tamaszok, cfg) {
    const hibak = [], figy = [];
    const add = (lista, kod, szoveg, dobozok = []) => lista.push({ kod, szoveg, dobozok });
    const S = stopok(placed), byId = new Map(placed.map((b) => [b.id, b]));
    // Ki áll (közvetve) kin: felett[p] = p fölötti egységek halmaza.
    const kozvetlenFelett = new Map(placed.map((b) => [b.id, []]));
    for (const [fid, lista] of tamaszok) for (const a of lista) if (kozvetlenFelett.has(a.id)) kozvetlenFelett.get(a.id).push(fid);
    const felett = new Map();
    const felettHalmaz = (id) => {
      if (felett.has(id)) return felett.get(id);
      const h = new Set(); felett.set(id, h);
      for (const f of kozvetlenFelett.get(id) || []) { h.add(f); for (const g of felettHalmaz(f)) h.add(g); }
      return h;
    };
    const F = new Map(placed.map((b) => [b.id, folyoso(V.get(b.id), oldal(b, cfg), t, cfg.oldalRahagyasCm ?? 0, emelesCm(b, cfg))]));
    // Akadályozási reláció: elotte[p] = azok, akiket p előtt el kell távolítani (bármely lerakóból).
    const elotte = new Map(placed.map((b) => [b.id, new Set()]));
    for (const p of placed) {
      for (const f of felettHalmaz(p.id)) elotte.get(p.id).add(f);
      const fp = F.get(p.id);
      for (const q of placed) if (q.id !== p.id && atfed(fp, V.get(q.id))) elotte.get(p.id).add(q.id);
    }
    // 1. Átrakás nélküliség (csak ha van lerakósorrend).
    const atrakott = new Set(), blokk = new Map();
    if (S.van) {
      for (const p of placed) {
        const bl = [...elotte.get(p.id)].filter((q) => S.eff(byId.get(q)) > S.eff(p));
        if (!bl.length) continue;
        blokk.set(p.id, bl);
        for (const q of bl) {
          atrakott.add(q);
          const qb = byId.get(q), fent = felettHalmaz(p.id).has(q);
          add(hibak, 'LERAKO_SORREND', fent
            ? `${nev(qb)} (${S.eff(qb)}. lerakó) ${nev(p)} (${S.eff(p)}. lerakó) fölött áll – lerakodáskor át kellene rakni.`
            : `${nev(qb)} (${S.eff(qb)}. lerakó) elzárja ${nev(p)} (${S.eff(p)}. lerakó) kivételi útját (${OLDALAK[oldal(p, cfg)]}) – lerakodáskor át kellene rakni.`, [p.id, q]);
        }
      }
    }
    // 2. Kezelhetőség.
    for (const p of placed) {
      const old = oldal(p, cfg);
      if (!villaOk(p, old)) add(hibak, 'KEZELES_IRANY', `${nev(p)}: a villanyílás nem a kivételi irány (${OLDALAK[old]}) felé néz – forgasd el 90°-kal.`, [p.id]);
      const v = V.get(p.id);
      if (kezeles(p) === 'kezi' && v.z1 > (cfg.keziMaxMagassagCm ?? 180)) add(figy, 'KEZI_MAGASSAG', `${nev(p)}: kézi kezelésű egység ${v.z1} cm magasan végződik (ajánlott legfeljebb ${cfg.keziMaxMagassagCm ?? 180} cm).`, [p.id]);
    }
    // 3. Csoportosítás: egy lerakó egységei összefüggő tömbben (érintkező lapok).
    if (S.van) {
      const erint = (a, b) => {
        const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0), oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
        return (ox >= 0 && oy >= 0 && oz >= 0) && ((ox === 0 ? 1 : 0) + (oy === 0 ? 1 : 0) + (oz === 0 ? 1 : 0)) <= 1;
      };
      const csop = new Map();
      for (const p of placed) { const s = S.eff(p); if (!csop.has(s)) csop.set(s, []); csop.get(s).push(p); }
      for (const [s, lista] of csop) {
        if (lista.length < 2) continue;
        const seen = new Set(); let komp = 0;
        for (const p of lista) {
          if (seen.has(p.id)) continue;
          komp++; const st = [p]; seen.add(p.id);
          while (st.length) { const a = st.pop(); for (const b of lista) if (!seen.has(b.id) && erint(V.get(a.id), V.get(b.id))) { seen.add(b.id); st.push(b); } }
        }
        if (komp > 1 && s <= S.max) add(figy, 'LERAKO_SZIGET', `A(z) ${s}. lerakó egységei ${komp} külön csoportban vannak – lerakodáskor több helyről kell összeszedni.`, lista.map((b) => b.id));
      }
    }
    // 4. Lerakodási sorrend (Kahn-algoritmus prioritással): lerakó szerint, azon belül a kivételi oldalhoz legközelebbi, legfelső.
    const prioritas = (b) => {
      const v = V.get(b.id), old = oldal(b, cfg);
      const tav = old === 'bal' ? v.y0 : old === 'jobb' ? t.width - v.y1 : old === 'felso' ? 0 : t.length - v.x1;
      return [S.eff(b), tav, -v.z0, v.y0, b.id];
    };
    const kisebb = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; };
    const fok = new Map(placed.map((b) => [b.id, elotte.get(b.id).size]));
    const utana = new Map(placed.map((b) => [b.id, []]));
    for (const p of placed) for (const q of elotte.get(p.id)) utana.get(q).push(p.id);
    const kesz = new Set(), lerakodasiSorrend = [];
    while (lerakodasiSorrend.length < placed.length) {
      let jelolt = null;
      for (const b of placed) if (!kesz.has(b.id) && fok.get(b.id) === 0 && (!jelolt || kisebb(prioritas(b), prioritas(jelolt)))) jelolt = b;
      if (!jelolt) { // körkörös akadályozás (csak hibás tervnél): a legkisebb prioritású kerül sorra
        for (const b of placed) if (!kesz.has(b.id) && (!jelolt || kisebb(prioritas(b), prioritas(jelolt)))) jelolt = b;
      }
      kesz.add(jelolt.id); lerakodasiSorrend.push(jelolt.id);
      for (const n of utana.get(jelolt.id)) fok.set(n, fok.get(n) - 1);
    }
    // 5. Időbecslés.
    const ido = cfg.idok || {};
    const egysegIdo = (b) => {
      const v = V.get(b.id), old = oldal(b, cfg), k = kezeles(b);
      const tav = old === 'bal' ? v.y0 : old === 'jobb' ? t.width - v.y1 : old === 'felso' ? 0 : t.length - v.x1;
      let s = (ido[k] ?? 60) + (tav / 100) * (cfg.melysegSpM ?? 4);
      if (v.z0 > 0) s += cfg.szintPotlekS ?? 20;
      if (k === 'kezi' && v.z1 > 150) s += 10;
      return s;
    };
    const stopLista = [];
    const effek = [...new Set(placed.map((b) => S.eff(b)))].sort((a, b) => a - b);
    for (const s of effek) {
      const tagok = placed.filter((b) => S.eff(b) === s);
      const atr = new Set(); for (const p of tagok) for (const q of blokk.get(p.id) || []) atr.add(q);
      const idoS = tagok.reduce((a, b) => a + egysegIdo(b), 0) + atr.size * (cfg.atrakasBuntetesS ?? 120);
      stopLista.push({ stop: s, megallo: S.van && s <= S.max ? s : null, db: tagok.length, tomegKg: tagok.reduce((a, b) => a + b.weight, 0), idoS, atrakas: atr.size, oldalak: [...new Set(tagok.map((b) => oldal(b, cfg)))] });
    }
    const osszIdoS = stopLista.reduce((a, s) => a + s.idoS, 0);
    // 6. Tengelyterhelés minden lerakó után (a maradék rakománnyal).
    if (S.van && t.profil !== false) {
      const p = J.profil(t);
      for (const st of stopLista) {
        const maradek = placed.filter((b) => S.eff(b) > st.stop);
        if (!maradek.length) { st.tengely = null; continue; }
        const tg = J.tengelyek(t, maradek.map((b) => { const v = V.get(b.id); return { kg: b.weight, x: (v.x0 + v.x1) / 2 }; }), p);
        st.tengely = tg;
        for (const a of tg.tengelyek) if (a.tul) add(hibak, 'TENGELYTERHELES', `A(z) ${st.stop}. lerakó után: ${a.nev} ${Math.round(a.osszKg)} kg > megengedett ${Math.round(a.maxKg)} kg.`, maradek.map((b) => b.id));
        if (tg.kormanyzott && !tg.kormanyzott.ok) add(hibak, 'KORMANYZOTT_TENGELY', `A(z) ${st.stop}. lerakó után a kormányzott tengely terhelése ${tg.kormanyzott.aranyPct.toFixed(1)}% (legalább ${tg.kormanyzott.minPct}% kell).`, maradek.map((b) => b.id));
      }
    }
    return {
      hibak, figyelmeztetesek: figy, van: S.van, atrakas: atrakott.size, atrakottak: [...atrakott], blokk,
      stopok: stopLista, osszIdoS, lerakodasiSorrend, rakodasiSorrend: lerakodasiSorrend.slice().reverse(),
      oldal: (b) => oldal(b, cfg), eff: S.eff, egysegIdo,
    };
  }

  return { OLDALAK, KEZELES, oldal, kezeles, folyoso, emelesCm, villaOk, stopok, elemez };
});
