"""Rakodástervező 3D → FuvarDíj 4.0 adatkapcsolat (előkészítés).

A FuvarDíj 4.0 kódját NEM módosítja: a megadott mappából csak importálja a meglévő, ellenőrzött
függvényeket (ldm_calculator.elszamolasi_ldm, ldm_calculator.elmeleti_ldm, pricing.szamol_dij).

Mit csinál:
1. Beolvassa és ellenőrzi a 3D tervezőből exportált „fuvardij4-rakodasi-csomag” JSON-t.
2. A FuvarDíj 4.0 eredeti függvényével újraszámolja a díjszámítási LDM-et, és összeveti a csomagban
   lévő (JS-tükörrel számolt) értékkel. Eltérésnél nem enged árajánlatot.
3. Opcionálisan ajánlati árat számol – kizárólag a FuvarDíj 4.0 pricing.szamol_dij függvényével és a
   felhasználó által megadott (a kalkulátorban ellenőrzött) díjparaméterekkel. Alapértelmezett
   tarifát, díjat vagy súlyátváltási arányt ez a modul nem tartalmaz.

Használat:
    py fuvardij4_adapter.py csomag.json --fuvardij <FuvarDíj 4.0 mappa>
    py fuvardij4_adapter.py csomag.json --fuvardij <mappa> --dijparameterek dij.json
"""

from __future__ import annotations

import argparse
import importlib
import json
import math
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any

CSOMAG_FORMATUM = "fuvardij4-rakodasi-csomag"
TAMOGATOTT_VERZIOK = {1}
TURES = 1e-9


class CsomagHiba(ValueError):
    """Érvénytelen vagy nem egyező adatcsomag."""


def fuvardij_modulok(fuvardij_mappa: str | Path):
    """A FuvarDíj 4.0 modulok importálása a megadott mappából (olvasás, módosítás nélkül)."""
    mappa = Path(fuvardij_mappa).resolve()
    for f in ("billing_config.py", "ldm_calculator.py", "pricing.py"):
        if not (mappa / f).is_file():
            raise FileNotFoundError(f"Nem található a FuvarDíj 4.0 fájl: {mappa / f}")
    if str(mappa) not in sys.path:
        sys.path.insert(0, str(mappa))
    return (importlib.import_module("billing_config"), importlib.import_module("ldm_calculator"),
            importlib.import_module("pricing"))


def betolt(path: str | Path) -> dict[str, Any]:
    return ellenoriz_szerkezet(json.loads(Path(path).read_text(encoding="utf-8")))


def ellenoriz_szerkezet(cs: dict[str, Any]) -> dict[str, Any]:
    if cs.get("format") != CSOMAG_FORMATUM or cs.get("verzio") not in TAMOGATOTT_VERZIOK:
        raise CsomagHiba("Nem FuvarDíj 4.0 rakodási csomag, vagy nem támogatott verzió.")
    for kulcs in ("potkocsi", "rakomanyok", "ldm", "ellenorzes", "osszesites"):
        if kulcs not in cs:
            raise CsomagHiba(f"Hiányzó mező: {kulcs}")
    pk = cs["potkocsi"]
    for k in ("hossz_cm", "szelesseg_cm", "magassag_cm"):
        if not isinstance(pk.get(k), int) or pk[k] <= 0:
            raise CsomagHiba(f"A pótkocsi {k} mezője pozitív egész cm legyen.")
    for r in cs["rakomanyok"]:
        for k in ("hossz_cm", "szelesseg_cm", "magassag_cm"):
            if not isinstance(r.get(k), int) or r[k] <= 0:
                raise CsomagHiba(f"{r.get('azonosito')}: a {k} pozitív egész cm legyen.")
        if not (isinstance(r.get("tomeg_kg"), (int, float)) and math.isfinite(r["tomeg_kg"]) and r["tomeg_kg"] > 0):
            raise CsomagHiba(f"{r.get('azonosito')}: érvénytelen tömeg.")
        if r.get("elhelyezve"):
            p = r.get("pozicio_cm") or {}
            if not all(isinstance(p.get(k), int) for k in ("x", "y", "z")):
                raise CsomagHiba(f"{r.get('azonosito')}: a pozíció egész cm legyen.")
    if cs.get("arazas") is not None:
        raise CsomagHiba("A csomag nem tartalmazhat előre kitöltött díjat; az árat a FuvarDíj 4.0 számolja.")
    return cs


def ujraszamol(cs: dict[str, Any], fuvardij_mappa: str | Path) -> dict[str, Any]:
    """A díjszámítási és elméleti LDM újraszámolása a FuvarDíj 4.0 eredeti függvényeivel."""
    billing_config, ldm_calculator, _ = fuvardij_modulok(fuvardij_mappa)
    d = cs.get("dijszamitas")
    if not d:
        raise CsomagHiba("A csomagban nincs díjszámítási beállítás.")
    cfg = billing_config.ElszamolasiKonfig(kg_per_ldm=float(d["kg_per_ldm"]), kerekites=d["kerekites"], szabaly=d["szabaly"])
    elhelyezett = [r for r in cs["rakomanyok"] if r["elhelyezve"]]
    tomeg = sum(r["tomeg_kg"] for r in elhelyezett)
    # A fizikai LDM a pozíciókból is ellenőrizhető: homlokfaltól a legtávolabbi élig.
    hossz = max((r["pozicio_cm"]["x"] + r["alapterulet_hossz_cm"] for r in elhelyezett), default=0)
    fizikai = ldm_calculator.fizikai_ldm(hossz)
    eredmeny = ldm_calculator.elszamolasi_ldm(fizikai, tomeg, cfg)
    elmeleti = sum(ldm_calculator.elmeleti_ldm(1, r["hossz_cm"], r["szelesseg_cm"], cs["potkocsi"]["szelesseg_cm"])
                   for r in cs["rakomanyok"])
    eltérések = []
    if cs["ldm"]["fizikai"] is None or abs(fizikai - cs["ldm"]["fizikai"]) > TURES:
        eltérések.append(f"Fizikai LDM: csomag {cs['ldm']['fizikai']} ≠ pozíciókból {fizikai}")
    if cs["ldm"]["dijszamitasi"] is None or abs(eredmeny.elszamolasi_ldm - cs["ldm"]["dijszamitasi"]) > TURES:
        eltérések.append(f"Díjszámítási LDM: csomag {cs['ldm']['dijszamitasi']} ≠ FuvarDíj 4.0 {eredmeny.elszamolasi_ldm}")
    if abs(elmeleti - cs["ldm"]["elmeleti_halmozas_nelkul"]) > 1e-6:
        eltérések.append(f"Elméleti LDM: csomag {cs['ldm']['elmeleti_halmozas_nelkul']} ≠ FuvarDíj 4.0 {elmeleti}")
    if abs(tomeg - cs["osszesites"]["elhelyezett_tomeg_kg"]) > TURES:
        eltérések.append("Az elhelyezett tömeg nem egyezik a tételek összegével.")
    return {
        "elszamolas": asdict(eredmeny),
        "fizikai_ldm": fizikai,
        "elmeleti_ldm_halmozas_nelkul": elmeleti,
        "elhelyezett_tomeg_kg": tomeg,
        "egyezik": not eltérések,
        "elteresek": eltérések,
    }


def arajanlat(cs: dict[str, Any], fuvardij_mappa: str | Path, dijparameterek: dict[str, Any]):
    """Ajánlati ár a FuvarDíj 4.0 pricing.szamol_dij függvényével.

    A díjparamétereket (pl. dij_per_ldm, minimum_dij, felárak) a felhasználónak kell megadnia a
    kalkulátorban ellenőrzött díjszabás szerint. Az LDM és a tömeg a csomagból jön, felülírni nem lehet.
    """
    if not cs.get("ajanlatra_alkalmas"):
        raise CsomagHiba("A terv nem alkalmas árajánlatra: " + " ".join(cs.get("ajanlat_akadalyai") or ["hibás vagy hiányos terv."]))
    # Független ellenőrzés: ismeretlen ráterhelésű egységre halmozott terv nem árazható (FuvarDíj 4.0 elv).
    alatta = {r.get("alatta_levo_belso_id") for r in cs["rakomanyok"]} - {None}
    if any(r["belso_id"] in alatta and r.get("max_raterheles_kg") is None for r in cs["rakomanyok"]):
        raise CsomagHiba("Ismeretlen ráterhelésű egységre halmozott rakomány – nem igazolt, nem árazható.")
    if any(not r["elhelyezve"] for r in cs["rakomanyok"]) or not cs["ellenorzes"]["megfelel"]:
        raise CsomagHiba("A csomag ellenőrzési adatai szerint a terv hibás vagy hiányos.")
    ell = ujraszamol(cs, fuvardij_mappa)
    if not ell["egyezik"]:
        raise CsomagHiba("A csomag értékei eltérnek a FuvarDíj 4.0 számításától: " + "; ".join(ell["elteresek"]))
    _, _, pricing = fuvardij_modulok(fuvardij_mappa)
    tiltott = {"ldm", "ossz_kg"} & set(dijparameterek)
    if tiltott:
        raise CsomagHiba(f"Ezeket a csomag határozza meg, nem adhatók meg kézzel: {', '.join(sorted(tiltott))}")
    if not dijparameterek:
        raise CsomagHiba("Díjparaméterek nélkül nem számolható ár (a modul nem tartalmaz tarifát).")
    p = pricing.DijParameterek(ldm=ell["elszamolas"]["elszamolasi_ldm"], ossz_kg=ell["elhelyezett_tomeg_kg"],
                               **{"dij_per_ldm": 0.0, **dijparameterek})
    return pricing.szamol_dij(p), ell


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Rakodástervező 3D csomag ellenőrzése a FuvarDíj 4.0-val.")
    ap.add_argument("csomag")
    ap.add_argument("--fuvardij", required=True, help="A FuvarDíj 4.0 forrásmappája (feature/fuvardij-4)")
    ap.add_argument("--dijparameterek", help="JSON a pricing.DijParameterek mezőivel (ldm és ossz_kg nélkül)")
    a = ap.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # Windows-konzolon is helyes ékezetek
    cs = betolt(a.csomag)
    ell = ujraszamol(cs, a.fuvardij)
    print(f"Terv: {cs['terv']['nev']} ({cs['terv']['azonosito']})")
    print(f"Fizikai LDM: {ell['fizikai_ldm']:.2f}  Díjszámítási LDM (FuvarDíj 4.0): {ell['elszamolas']['elszamolasi_ldm']:.2f}"
          f"  – meghatározó: {ell['elszamolas']['meghatarozo']}")
    print("Egyezés a csomaggal: " + ("IGEN" if ell["egyezik"] else "NEM – " + "; ".join(ell["elteresek"])))
    print("Árajánlatra alkalmas: " + ("igen" if cs["ajanlatra_alkalmas"] else "nem"))
    for f in cs["ellenorzes"]["nem_ellenorzott_feltetelek"]:
        print("  [nem ellenőrzött] " + f)
    if a.dijparameterek:
        dij, _ = arajanlat(cs, a.fuvardij, json.loads(Path(a.dijparameterek).read_text(encoding="utf-8")))
        print(f"Ajánlati ár (FuvarDíj 4.0 szamol_dij): {dij.ajanlott_ar:.2f} {dij.penznem}")
    return 0 if ell["egyezik"] else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except CsomagHiba as hiba:
        print(f"ELUTASÍTVA: {hiba}")
        raise SystemExit(2)
