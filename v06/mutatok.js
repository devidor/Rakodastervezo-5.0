/*
 * Rakománytervező 3D V06 – LDM- és kihasználtsági mutatók
 * ------------------------------------------------------
 * Külön, egyértelmű címkével:
 *   - Elméleti (területalapú) LDM = Σ alapterület (m²) ÷ referenciaszélesség (m), alapérték 2,40 m, konfigurálható.
 *     Független a pótkocsi belső szélességétől (alapérték 245 cm).
 *   - Halmozással korrigált elméleti LDM: azonos tételek a megengedett szintszám szerint oszlopokba rendezve.
 *   - Fizikai helyigény: a legtávolabbi rakománypont x-koordinátája a homlokfaltól (m).
 *   - Díjszámítási LDM: változatlanul a V05 / FuvarDíj 4.0 szabálya (ldm_modul.elszamolas).
 * A fizikai helyigény és az elméleti LDM NEM azonos díjszámítási alap.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./ldm_modul.js'), require('./ellenorzo.js'), require('./szabad_ter.js'));
  else root.Mutatok = factory(root.LDMModul, root.Ellenorzo, root.SzabadTer);
})(typeof self !== 'undefined' ? self : this, function (LDM, E, SZ) {
  'use strict';
  const ALAP_REF_SZELESSEG_CM = 240;

  /** Elméleti LDM a megadott referenciaszélességgel (a V05 csoportosító módszerével, V06 halmozási szabályokkal). */
  function elmeleti(t, boxes, refCm = ALAP_REF_SZELESSEG_CM) {
    const nb = boxes.map(E.normalizal);
    const e = LDM.elmeleti({ ...t, width: refCm }, nb);
    return {
      refSzelessegCm: refCm,
      halmozasNelkul: e.halmozasNelkul,
      halmozassalKorrigalt: e.adatokbolHalmozva,
      tervSzerint: e.tervSzerintiHalmozas,
      csoportok: e.csoportok,
      feltetelezesek: e.feltetelezesek.filter((f) => !f.startsWith('Referencia-szélesség')).concat(`Referenciaszélesség: ${refCm} cm (konfigurálható; a pótkocsi belső szélessége ettől független: ${t.width} cm).`),
    };
  }

  /**
   * Teljes mutatókészlet egy tervhez.
   * @param {{trailer, boxes, elszamolas?}} terv
   * @param {{refSzelessegCm?:number, szabadTer?:boolean, alapHosszCm?:number}} beall
   */
  function szamol(terv, beall = {}) {
    const t = terv.trailer, boxes = terv.boxes.map(E.normalizal);
    const ell = E.ellenoriz({ trailer: t, boxes }, { sorrend: !!beall.sorrend });
    const adatHiba = ell.hibak.some((h) => h.kod === 'ADAT');
    const placed = boxes.filter((b) => b.placed);
    const osszTomeg = boxes.reduce((s, b) => s + b.weight, 0);
    const elhTomeg = placed.reduce((s, b) => s + b.weight, 0);
    const belso = t.length * t.width * t.height;
    const rakTerf = placed.reduce((s, b) => s + b.length * b.width * b.height, 0);
    const out = {
      ellenorzes: ell, allapot: ell.allapot,
      darab: boxes.length, elhelyezett: placed.length, kimaradt: boxes.length - placed.length,
      osszTomegKg: osszTomeg, elhelyezettTomegKg: elhTomeg,
      hasznosTeherKg: t.payloadKg, szabadTeherKg: t.payloadKg - elhTomeg,
      terfogatKihasznaltsagPct: rakTerf / belso * 100,
      szabadTerfogatM3: (belso - rakTerf) / 1e6,
      rakomanyTerfogatM3: rakTerf / 1e6,
      elmeleti: null, fizikai: null, dijszamitas: null, szabad: null,
    };
    if (adatHiba) return out;
    out.elmeleti = elmeleti(t, boxes, beall.refSzelessegCm || ALAP_REF_SZELESSEG_CM);
    const f = LDM.fizikai(t, boxes);
    out.fizikai = {
      helyigenyM: f.hasznaltHosszCm / 100, helyigenyCm: f.hasznaltHosszCm,
      homlokfalHezagCm: f.homlokfalHezagCm, nettoFoglaltHosszCm: f.nettoFoglaltHosszCm,
      elfoglaltPadloM2: f.alapteruletCm2 / 1e4, szabadPadloM2: f.szabadTeruletOsszesCm2 / 1e4,
      padloKihasznaltsagPct: f.padloKihasznaltsagPct, maradoHosszCm: f.maradoHosszCm,
    };
    if (Number.isFinite(beall.alapHosszCm)) {
      out.fizikai.alapHosszCm = beall.alapHosszCm;
      out.fizikai.megtakaritasCm = beall.alapHosszCm - f.hasznaltHosszCm;
    }
    try { out.dijszamitas = LDM.elszamolas(f.ldm, elhTomeg, { ...LDM.ALAP_ELSZAMOLAS, ...(terv.elszamolas || {}) }); } catch { out.dijszamitas = null; }
    if (beall.szabadTer !== false) out.szabad = SZ.elemez(t, boxes, beall.szabadBeall || {});
    return out;
  }

  return { ALAP_REF_SZELESSEG_CM, elmeleti, szamol };
});
