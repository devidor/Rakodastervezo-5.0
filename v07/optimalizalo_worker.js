/*
 * Rakománytervező 3D V07 – optimalizáló Web Worker (beall.profi = true: V07 profi optimalizáló).
 * Üzenetek: be {tipus:'indit', terv, beall} | {tipus:'megszakit'}
 *           ki {tipus:'haladas', allapot} | {tipus:'kesz', eredmeny} | {tipus:'hiba', uzenet}
 * A számítás kis szeletekben fut, így a megszakítás üzenete is feldolgozható, és megszakításkor
 * az addigi legjobb eredmény marad meg.
 */
/* global importScripts, Optimalizalo, OptimalizaloProfi, Flotta */
importScripts('ldm_modul.js', 'geometria.js', 'ellenorzo.js', 'szabad_ter.js', 'optimalizalo.js', 'jarmu.js', 'lerakodas.js', 'biztonsag.js', 'optimalizalo_profi.js', 'flotta.js');
let kereses = null;
self.onmessage = (e) => {
  const m = e.data || {};
  if (m.tipus === 'indit' || m.tipus === 'flotta-indit') {
    try {
      kereses = m.tipus === 'flotta-indit' ? Flotta.szetosztInditas(m.terv, m.spec, m.beall)
        : (m.beall && m.beall.profi ? OptimalizaloProfi : Optimalizalo).keresesInditas(m.terv, m.beall);
    } catch (err) { self.postMessage({ tipus: 'hiba', uzenet: err.message }); return; }
    const kor = () => {
      if (!kereses) return;
      try {
        const a = kereses.lepes(60);
        self.postMessage({ tipus: 'haladas', allapot: a });
        if (a.kesz) { self.postMessage({ tipus: 'kesz', eredmeny: kereses.eredmeny() }); kereses = null; }
        else setTimeout(kor, 0);
      } catch (err) { self.postMessage({ tipus: 'hiba', uzenet: err.message }); kereses = null; }
    };
    kor();
  } else if (m.tipus === 'megszakit' && kereses) {
    kereses.megszakit();
    self.postMessage({ tipus: 'kesz', eredmeny: kereses.eredmeny() });
    kereses = null;
  }
};
