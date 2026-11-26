# Rakománytervező 3D

Két, egymástól független verzió, mindkettő GitHub Pages-en is futtatható:

| Verzió | Mappa | Webcím (GitHub Pages) | Állapot |
|---|---|---|---|
| Verzióválasztó | `/` (`index.html`) | https://devidor.github.io/Rakodastervezo-5.0/ | – |
| **V05** | [`v05/`](v05/) | https://devidor.github.io/Rakodastervezo-5.0/v05/ | stabil |
| **V06 – Smart Load Optimizer** | [`v06/`](v06/) | https://devidor.github.io/Rakodastervezo-5.0/v06/ | fejlesztési |

## Függetlenség
- Mindkét mappa önálló: saját `index.html`, saját `ldm_modul.js`, tesztek, mintatervek. A mappák között nincs fájlhivatkozás, minden erőforrás-útvonal relatív.
- A V06 további fejlesztése csak a `v06/` mappát érinti. A `v05/` fájljai bájtra azonosak a korábbi (gyökérben lévő) V05-tel.
- Böngészőtárhely: a V05 a `rakodastervezo3d.v05.tervek`, a V06 a `rakodastervezo3d.v06.tervek` kulcsot használja. A V06 első indításkor egyszer átveszi a V05 tervlistáját, csak olvasva.

## Helyi futtatás
```powershell
py -m http.server 8137
```
Ezután nyisd meg: http://localhost:8137/ (verzióválasztó), `/v05/`, `/v06/`.

## GitHub Pages beállítás
Settings → Pages → Deploy from a branch → `main` / `(root)`. A verziók a fenti címeken érhetők el.

Részletek: [v05/README.md](v05/README.md) · [v06/README.md](v06/README.md)
