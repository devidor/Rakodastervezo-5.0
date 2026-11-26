/*
 * Rakománytervező 3D V06 – optimalizáló Web Worker.
 * Üzenetek: be {tipus:'indit', terv, beall} | {tipus:'megszakit'}
 *           ki {tipus:'haladas', allapot} | {tipus:'kesz', eredmeny} | {tipus:'hiba', uzenet}
 * A számítás kis szeletekben fut, így a megszakítás üzenete is feldolgozható, és megszakításkor
 * az addigi legjobb eredmény marad meg.
 */
/* global importScripts, Optimalizalo */
importScripts('ldm_modul.js', 'geometria.js', 'ellenorzo.js', 'szabad_ter.js', 'optimalizalo.js');
let kereses = null;
self.onmessage = (e) => {
  const m = e.data || {};
  if (m.tipus === 'indit') {
    try { kereses = Optimalizalo.keresesInditas(m.terv, m.beall); } catch (err) { self.postMessage({ tipus: 'hiba', uzenet: err.message }); return; }
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
