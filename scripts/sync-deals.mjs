// Sincroniza data/deals.json (off market) desde la fuente privada.
// La fuente y el margen NO viven en el repositorio (que es público):
//   DEALS_SOURCE  URL de la página que lista los deals (secreto de GitHub)
//   DEALS_MARKUP  JSON con los tramos, p. ej. [{"upTo":150000,"pct":4},{"upTo":600000,"pct":3},{"upTo":null,"pct":2.2}]
// Para probar en tu computadora, puedes ponerlos en deals.private.json (ignorado por git).
// Solo se guarda el precio final con margen. Nunca se escribe ni se imprime el precio original.

import { readFile, writeFile } from "node:fs/promises";
import { dealUrlsFromListing, parseDeal, applyMarkup } from "./parse.mjs";

const root = new URL("..", import.meta.url);
const local = JSON.parse(await readFile(new URL("deals.private.json", root), "utf8").catch(() => "{}"));
const SOURCE = process.env.DEALS_SOURCE || local.source;
let tiers;
try { tiers = JSON.parse(process.env.DEALS_MARKUP || "null") || local.markup; } catch { tiers = null; }

if (!SOURCE || !Array.isArray(tiers) || !tiers.length) {
  console.log("ℹ Off market: falta DEALS_SOURCE o DEALS_MARKUP. Se conservan los deals publicados.");
  process.exit(0);
}

const dataPath = new URL("data/deals.json", root);
const previous = JSON.parse(await readFile(dataPath, "utf8").catch(() => '{"deals":[]}'));
const prevBySlug = new Map(previous.deals.map((d) => [d.slug, d]));

async function get(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; andysoflo-sync/1.0)" }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i >= tries) throw new Error(err.message); // sin URL: el log de Actions es público
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

let urls;
try {
  urls = dealUrlsFromListing(await get(SOURCE), new URL(SOURCE).origin);
} catch (err) {
  console.error("✖ Off market: no se pudo leer la fuente. Se conservan los datos anteriores.", err.message);
  process.exit(1);
}
if (!urls.length) {
  console.error("✖ Off market: la fuente no listó deals. Por seguridad no se cambia nada.");
  process.exit(1);
}

const money = (n) => "$" + n.toLocaleString("en-US");
const deals = [];
let problems = 0;
for (const url of urls) {
  const slug = url.replace(/\/+$/, "").split("/").pop();
  try {
    const d = parseDeal(await get(url), url);
    if (!d.address || !d.sourcePrice) throw new Error("faltan dirección o precio");
    const { sourcePrice, ...rest } = d;
    const price = applyMarkup(sourcePrice, tiers);
    const hide = (s) => String(s).split(money(sourcePrice)).join(money(price)); // nunca mostrar el precio original
    deals.push({ ...rest, price, notes: hide(rest.notes), extras: rest.extras.map((x) => ({ ...x, value: hide(x.value) })) });
  } catch {
    problems++;
    if (prevBySlug.has(slug)) deals.push(prevBySlug.get(slug));
  }
}

const changed = JSON.stringify(deals) !== JSON.stringify(previous.deals);
if (changed) await writeFile(dataPath, JSON.stringify({ updatedAt: new Date().toISOString(), deals }, null, 2) + "\n");
const added = deals.filter((d) => !prevBySlug.has(d.slug)).length;
const removed = previous.deals.filter((d) => !deals.some((x) => x.slug === d.slug)).length;
console.log(`✔ Off market: ${deals.length} deals · ${changed ? "con cambios" : "sin cambios"} · +${added} / −${removed}`);
if (problems) {
  console.warn(`⚠ Off market: ${problems} fichas no se pudieron leer (se conserva su versión anterior si existía).`);
  if (problems === urls.length) process.exit(1);
}
