"""A JS LDM-modul és a FuvarDíj 4.0 eredeti Python-kódjának egyezése, valamint az adapter tesztjei.

Futtatás:  set FUVARDIJ4_PATH=<FuvarDíj 4.0 forrásmappa>  &&  py -m pytest tests
(A mappa a fuvar-kalkulator feature/fuvardij-4 ágának kicsomagolt példánya; nem módosul.)
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

GYOKER = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(GYOKER / "fuvardij_kapcsolat"))
import fuvardij4_adapter as ad  # noqa: E402

FD = os.environ.get("FUVARDIJ4_PATH")
pytestmark = pytest.mark.skipif(not FD or not Path(FD, "ldm_calculator.py").is_file(),
                                reason="FUVARDIJ4_PATH nincs beállítva a FuvarDíj 4.0 forrásmappára")
ESETEK = json.loads((GYOKER / "tests" / "fixtures" / "parity_cases.json").read_text(encoding="utf-8"))
MINTAK = GYOKER / "mintatervek"


@pytest.fixture(scope="module")
def fd():
    return ad.fuvardij_modulok(FD)


@pytest.mark.parametrize("eset", [e for e in ESETEK["elszamolas"] if not e.get("kerekites_teszt")])
def test_dijszamitasi_ldm_egyezik(fd, eset):
    billing_config, ldm_calculator, _ = fd
    c = eset["cfg"]
    r = ldm_calculator.elszamolasi_ldm(eset["fizikai"], eset["kg"],
                                       billing_config.ElszamolasiKonfig(kg_per_ldm=c["kgPerLdm"], kerekites=c["kerekites"], szabaly=c["szabaly"]))
    assert r.elszamolasi_ldm == eset["elszamolasi_ldm"]  # bitre azonos
    assert r.tomegalapu_ldm == eset["tomegalapu_ldm"]
    assert r.meghatarozo == eset["meghatarozo"]


@pytest.mark.parametrize("eset", [e for e in ESETEK["elszamolas"] if e.get("kerekites_teszt")])
def test_kerekites_egyezik(fd, eset):
    _, ldm_calculator, _ = fd
    assert ldm_calculator.kerekit(eset["ertek"], eset["szabaly"]) == eset["eredmeny"]


@pytest.mark.parametrize("eset", ESETEK["elmeleti"])
def test_elmeleti_ldm_egyezik(fd, eset):
    _, ldm_calculator, _ = fd
    assert ldm_calculator.elmeleti_ldm(eset["darab"], eset["hossz"], eset["szelesseg"], eset["ref"]) == pytest.approx(eset["ldm"], abs=1e-12)


def test_kerekitesi_szabalyok_azonosak(fd):
    billing_config, _, _ = fd
    js = {e["szabaly"] for e in ESETEK["elszamolas"] if e.get("kerekites_teszt")}
    assert js == set(billing_config.KEREKITESI_SZABALYOK)


@pytest.mark.parametrize("betu", "ABC")
def test_mintacsomag_egyezik(betu):
    cs = ad.betolt(MINTAK / f"fuvardij4_csomag_{betu}.json")
    ell = ad.ujraszamol(cs, FD)
    assert ell["egyezik"], ell["elteresek"]
    assert cs["ajanlatra_alkalmas"] is True


def test_halmozott_tervnel_a_dijszamitasi_ldm_eltér():
    cs = ad.betolt(MINTAK / "fuvardij4_csomag_C.json")
    ell = ad.ujraszamol(cs, FD)
    assert ell["fizikai_ldm"] == 2.4
    assert ell["elszamolas"]["elszamolasi_ldm"] == pytest.approx(3.1)  # 5400 kg ÷ 1750, felfelé 0,1
    assert ell["elszamolas"]["meghatarozo"] == "tömeg"


def test_hibas_terv_nem_arazhato():
    cs = ad.betolt(MINTAK / "fuvardij4_csomag_D.json")
    assert cs["ajanlatra_alkalmas"] is False
    with pytest.raises(ad.CsomagHiba):
        ad.arajanlat(cs, FD, {"dij_per_ldm": 1.0})


def test_ar_csak_megadott_parameterekkel_es_szamol_dij_fuggvennyel(fd):
    _, _, pricing = fd
    cs = ad.betolt(MINTAK / "fuvardij4_csomag_A.json")
    with pytest.raises(ad.CsomagHiba):
        ad.arajanlat(cs, FD, {})  # nincs beépített tarifa
    with pytest.raises(ad.CsomagHiba):
        ad.arajanlat(cs, FD, {"dij_per_ldm": 1.0, "ldm": 1.0})  # LDM nem írható felül
    # Tetszőleges, tesztcélú paraméter – NEM tarifa. Az eredmény egyezzen a közvetlen szamol_dij hívással.
    param = {"dij_per_ldm": 1.0, "penznem": "EUR"}
    dij, ell = ad.arajanlat(cs, FD, param)
    kozvetlen = pricing.szamol_dij(pricing.DijParameterek(ldm=ell["elszamolas"]["elszamolasi_ldm"], ossz_kg=5400, **param))
    assert dij == kozvetlen


def test_ismeretlen_raterheles_halmozva_nem_arazhato():
    cs = ad.betolt(MINTAK / "fuvardij4_csomag_C.json")
    alul = next(r for r in cs["rakomanyok"] if r["belso_id"] == cs["rakomanyok"][1]["alatta_levo_belso_id"])
    alul["max_raterheles_kg"] = None  # akkor is elutasít, ha valaki az „ajanlatra_alkalmas” jelzőt átírná
    with pytest.raises(ad.CsomagHiba):
        ad.arajanlat(cs, FD, {"dij_per_ldm": 1.0})


def test_manipulalt_csomag_elutasitva():
    cs = ad.betolt(MINTAK / "fuvardij4_csomag_A.json")
    cs["ldm"]["dijszamitasi"] = 4.0
    assert ad.ujraszamol(cs, FD)["egyezik"] is False
    with pytest.raises(ad.CsomagHiba):
        ad.arajanlat(cs, FD, {"dij_per_ldm": 1.0})
    cs2 = ad.betolt(MINTAK / "fuvardij4_csomag_A.json")
    cs2["arazas"] = {"ar": 100}
    with pytest.raises(ad.CsomagHiba):
        ad.ellenoriz_szerkezet(cs2)
    cs3 = ad.betolt(MINTAK / "fuvardij4_csomag_A.json")
    cs3["rakomanyok"][0]["hossz_cm"] = 120.5
    with pytest.raises(ad.CsomagHiba):
        ad.ellenoriz_szerkezet(cs3)
