# Prepara el Alto Aller en 3D con datos del IGN (CC BY 4.0, © Instituto Geográfico Nacional):
#   - MDT05 (modelo digital del terreno, paso de 5 m) por WCS  https://servicios.idee.es/wcs-inspire/mdt
#   - Ortofoto PNOA por WMS                                     https://www.ign.es/wms-inspire/pnoa-ma
# Caja: lat 43,018–43,145, lon −5,590 – −5,350 (unos 19,5 × 14,1 km: de Collanzo al puerto de San Isidro y Fuentes de Invierno).
# Los datos crudos se guardan en ref/raw/terreno/ (no viajan a la web); la salida va a img/nieve/:
#   alturas-420.bin / alturas-280.bin (Uint16 little endian, decímetros, fila 0 = norte), orto-2048.jpg, orto-1024.jpg,
#   terreno.json (caja, tamaño en metros, lugares con su xz y su altura).
# Los lugares salen de ref/raw/nieve.json (OpenStreetMap), que escribe scripts/nieve-datos.mjs.
# Uso: python -I -X utf8 scripts/nieve-terreno.py
import io, json, math, pathlib, time, urllib.parse, urllib.request
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
R = pathlib.Path(__file__).resolve().parent.parent
RAW = R / 'ref/raw/terreno'; RAW.mkdir(parents=True, exist_ok=True)
OUT = R / 'img/nieve'; OUT.mkdir(parents=True, exist_ok=True)
UA = 'web-research-script/1.0'
S, N, O, E = 43.018, 43.145, -5.590, -5.350
lat0 = (S + N) / 2
ancho = (E - O) * 111320 * math.cos(math.radians(lat0))
alto = (N - S) * 110950

def traer(url, params, intentos=4):
    q = urllib.parse.urlencode(params, doseq=True)
    for i in range(intentos):
        try:
            with urllib.request.urlopen(urllib.request.Request(url + '?' + q, headers={'User-Agent': UA}), timeout=120) as r:
                b = r.read()
            if b[:2] in (b'II', b'MM') or b[:2] == b'\xff\xd8' or b[:4] == b'\x89PNG': return b
            print('respuesta rara', b[:200])
        except Exception as e:
            print('fallo', e)
        time.sleep(3)
    raise SystemExit('no se pudo traer ' + url)

# --- relieve: MDT05 en teselas de 4 × 2 ---
npz = RAW / 'mdt5.npz'   # alturas en decímetros (uint16), comprimido: ~15 millones de puntos a 5 m
if npz.exists():
    dem = np.load(npz)['dm'].astype(np.float32) / 10
else:
    nx, ny = 4, 2
    filas = []
    for j in range(ny):                     # de norte a sur
        n1 = N - (N - S) * j / ny; s1 = N - (N - S) * (j + 1) / ny
        fila = []
        for i in range(nx):
            o1 = O + (E - O) * i / nx; e1 = O + (E - O) * (i + 1) / nx
            b = traer('https://servicios.idee.es/wcs-inspire/mdt', [('SERVICE', 'WCS'), ('VERSION', '2.0.1'), ('REQUEST', 'GetCoverage'), ('COVERAGEID', 'Elevacion4258_5'), ('FORMAT', 'image/tiff'), ('SUBSET', f'Lat({s1:.6f},{n1:.6f})'), ('SUBSET', f'Long({o1:.6f},{e1:.6f})')])
            a = np.array(Image.open(io.BytesIO(b)), dtype=np.float32)
            print('tesela', j, i, a.shape, a.min(), a.max()); fila.append(a)
        h = min(t.shape[0] for t in fila)
        filas.append(np.concatenate([t[:h] for t in fila], axis=1))
    w = min(f.shape[1] for f in filas)
    dem = np.concatenate([f[:, :w] for f in filas], axis=0)
    dem[dem < -100] = np.nan
    np.savez_compressed(npz, dm=np.round(np.nan_to_num(dem, nan=0) * 10).astype('<u2'))
print('MDT05', dem.shape, np.nanmin(dem), np.nanmax(dem))
dem = np.nan_to_num(dem, nan=float(np.nanmin(dem)))
def remuestrear(a, cw, ch):               # media por bloques (sin aliasing) y luego bilineal
    f = max(1, int(min(a.shape[1] / cw, a.shape[0] / ch)))
    h, w = (a.shape[0] // f) * f, (a.shape[1] // f) * f
    b = a[:h, :w].reshape(h // f, f, w // f, f).mean(axis=(1, 3))
    return np.array(Image.fromarray(b).resize((cw, ch), Image.BILINEAR), dtype=np.float32)
for cw, ch in ((420, 303), (280, 202)):
    a = remuestrear(dem, cw, ch)
    (OUT / f'alturas-{cw}.bin').write_bytes(np.round(a * 10).astype('<u2').tobytes())
    print(f'alturas-{cw}.bin', a.shape, a.min(), a.max())

# --- ortofoto PNOA en 2 × 2 teselas de 1024 × 740 ---
orto = RAW / 'pnoa-2048.jpg'
if not orto.exists():
    W, H = 2048, 1480
    lienzo = Image.new('RGB', (W, H))
    for j in range(2):
        for i in range(2):
            n1 = N - (N - S) * j / 2; s1 = N - (N - S) * (j + 1) / 2
            o1 = O + (E - O) * i / 2; e1 = O + (E - O) * (i + 1) / 2
            b = traer('https://www.ign.es/wms-inspire/pnoa-ma', [('SERVICE', 'WMS'), ('VERSION', '1.3.0'), ('REQUEST', 'GetMap'), ('LAYERS', 'OI.OrthoimageCoverage'), ('STYLES', ''), ('CRS', 'EPSG:4326'), ('BBOX', f'{s1:.6f},{o1:.6f},{n1:.6f},{e1:.6f}'), ('WIDTH', 1024), ('HEIGHT', 740), ('FORMAT', 'image/jpeg')])
            lienzo.paste(Image.open(io.BytesIO(b)).convert('RGB'), (i * 1024, j * 740)); print('orto', j, i)
    lienzo.save(orto, quality=90)
foto = Image.open(orto).convert('RGB')
foto.resize((2048, 1480), Image.LANCZOS).save(OUT / 'orto-2048.jpg', quality=72, optimize=True, progressive=True)
foto.resize((1024, 740), Image.LANCZOS).save(OUT / 'orto-1024.jpg', quality=76, optimize=True, progressive=True)

# --- lugares (xz en metros desde el centro: x al este, z al sur) ---
def local(lat, lon): return [round((lon - (O + E) / 2) / (E - O) * ancho, 1), round(((S + N) / 2 - lat) / (N - S) * alto, 1)]
def altura(lat, lon):
    h, w = dem.shape
    return round(float(dem[min(h - 1, int((N - lat) / (N - S) * h)), min(w - 1, int((lon - O) / (E - O) * w))]), 1)
datos = json.loads((R / 'ref/raw/nieve.json').read_text(encoding='utf-8'))
lugares = {}
for k, l in datos['lugares'].items():
    lugares[k] = {'nombre': l['nombre'], 'lat': round(l['lat'], 5), 'lon': round(l['lon'], 5), 'xz': local(l['lat'], l['lon']), 'h': altura(l['lat'], l['lon']), 'osm': l.get('osm')}
meta = {'caja': {'s': S, 'n': N, 'o': O, 'e': E}, 'ancho': round(ancho, 1), 'alto': round(alto, 1), 'min': float(dem.min()), 'max': float(dem.max()),
        'rejillas': {'420': [420, 303], '280': [280, 202]}, 'orto': {'2048': [2048, 1480], '1024': [1024, 740]},
        'lugares': lugares, 'carretera': datos.get('carretera'), 'fuente': 'MDT05 y ortofoto PNOA © Instituto Geográfico Nacional (CC BY 4.0)'}
# la carretera (traza de OSRM de la casa a Fuentes de Invierno), con su altura, y los minutos por carretera
if datos.get('carretera'):
    meta['carretera'] = [[local(lat, lon)[0], local(lat, lon)[1], altura(lat, lon)] for lon, lat in datos['carretera']]
rutas = json.loads((R / 'ref/raw/rutas.json').read_text(encoding='utf-8'))
meta['rutas'] = {k: {'km': rutas['destinos'][v]['km'], 'min': rutas['destinos'][v]['min']} for k, v in (('fuentes', 'fuentes-de-invierno'), ('sanisidro', 'san-isidro'))}
meta['rutas']['fuente'] = 'OSRM sobre OpenStreetMap, ' + rutas['fecha'] + '; sin tráfico ni nieve'
# remontes y pistas (OSM), en metros, para dibujarlos sobre el relieve
def pl(pts): return [[round(local(lat, lon)[0]), round(local(lat, lon)[1])] for lon, lat in pts]
pistas = {'remontes': [{'n': r['nombre'], 't': r['tipo'], 'p': pl(r['pts'])} for r in datos['remontes']],
          'pistas': [{'n': r['nombre'], 'd': r['dificultad'], 'p': pl(r['pts'])} for r in datos['pistas']],
          'fuente': 'OpenStreetMap contributors (ODbL)'}
(OUT / 'pistas.json').write_text(json.dumps(pistas, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
(OUT / 'terreno.json').write_text(json.dumps(meta, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
for f in sorted(OUT.iterdir()): print(f.name, f.stat().st_size // 1024, 'KB')
