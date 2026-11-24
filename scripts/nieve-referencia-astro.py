# Trae de JPL Horizons (NASA, DE441) la posición del Sol y de la Luna vista desde la casa en fechas fijas y la guarda en
# pruebas/nieve-referencia-astro.json. Es la referencia INDEPENDIENTE de la prueba del sol y la luna de js/nieve.js.
# Sin refracción (AIRLESS), azimut desde el norte hacia el este. Uso: python -I -X utf8 scripts/nieve-referencia-astro.py
import json, pathlib, re, urllib.parse, urllib.request, datetime as dt
R = pathlib.Path(__file__).resolve().parent.parent
LAT, LON, ALT = 43.1231988, -5.5630593, 0.528
FECHAS = sorted(['2026-11-24T08:00:00Z', '2026-11-24T12:00:00Z', '2026-11-24T19:15:00Z', '2026-06-21T05:00:00Z', '2026-06-21T11:00:00Z', '2027-01-10T17:00:00Z', '2026-03-20T09:30:00Z'])   # Horizons devuelve las filas en orden de tiempo
def jd(s):
    d = dt.datetime.strptime(s, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=dt.timezone.utc)
    return 2440587.5 + d.timestamp() / 86400
def horizons(cuerpo):
    p = {'format': 'text', 'COMMAND': f"'{cuerpo}'", 'OBJ_DATA': "'NO'", 'MAKE_EPHEM': "'YES'", 'EPHEM_TYPE': "'OBSERVER'", 'CENTER': "'coord@399'", 'COORD_TYPE': "'GEODETIC'",
         'SITE_COORD': f"'{LON},{LAT},{ALT}'", 'TLIST': "'" + ' '.join(f'{jd(f):.6f}' for f in FECHAS) + "'", 'QUANTITIES': "'4'", 'ANG_FORMAT': "'DEG'", 'CSV_FORMAT': "'YES'"}
    req = urllib.request.Request('https://ssd.jpl.nasa.gov/api/horizons.api?' + urllib.parse.urlencode(p), headers={'User-Agent': 'web-research-script/1.0'})
    t = urllib.request.urlopen(req, timeout=90).read().decode('utf-8')
    filas = re.search(r'\$\$SOE(.*?)\$\$EOE', t, re.S).group(1).strip().splitlines()
    out = []
    for f in filas:
        c = [x.strip() for x in f.split(',')]
        out.append({'az': float(c[3]), 'alt': float(c[4])})
    return out
sol, luna = horizons('10'), horizons('301')
res = {'fuente': 'NASA/JPL Horizons (DE441), sin refracción', 'lugar': {'lat': LAT, 'lon': LON, 'altKm': ALT}, 'consultado': dt.date.today().isoformat(),
       'puntos': [{'fecha': f, 'sol': s, 'luna': l} for f, s, l in zip(FECHAS, sol, luna)]}
(R / 'pruebas').mkdir(exist_ok=True)
(R / 'pruebas/nieve-referencia-astro.json').write_text(json.dumps(res, indent=1), encoding='utf-8')
for p in res['puntos']: print(p)
