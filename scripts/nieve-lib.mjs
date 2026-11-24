// Utilidades comunes de los scripts de Nieve: Overpass con espejos y User-Agent genérico.
export const UA = 'web-research-script/1.0';
export const ESPEJOS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
export async function overpass(consulta, intentos = 2) {
  let ultimo = '';
  for (let i = 0; i < intentos; i++) for (const url of ESPEJOS) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(consulta), signal: AbortSignal.timeout(60000) });
      const t = await r.text();
      if (r.ok && t.startsWith('{')) return { elementos: JSON.parse(t).elements, espejo: url };
      ultimo = url + ' ' + r.status;
    } catch (e) { ultimo = url + ' ' + e.message; }
    console.error('fallo', ultimo);
  }
  throw new Error('Overpass caído: ' + ultimo);
}
