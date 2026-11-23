// Sincroniza data/projects.json con lo que está publicado en la fuente (broward.io).
// - Lee el sitemap para descubrir proyectos nuevos o eliminados.
// - Respeta el orden en que aparecen en la página de inicio de la fuente.
// - Nunca borra los datos si la fuente falla: conserva la última versión buena.
// Uso: node scripts/sync.mjs

import { readFile, writeFile } from "node:fs/promises";
import { parseProject, projectUrlsFromSitemap } from "./parse.mjs";

const root = new URL("..", import.meta.url);
const config = JSON.parse(await readFile(new URL("site.config.json", root), "utf8"));
const dataPath = new URL("data/projects.json", root);
const previous = JSON.parse(await readFile(dataPath, "utf8").catch(() => '{"projects":[]}'));
const prevBySlug = new Map(previous.projects.map((p) => [p.slug, p]));

const UA = "Mozilla/5.0 (compatible; andysoflo-sync/1.0; +https://" + config.domain + ")";

async function get(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i >= tries) throw new Error(`${url}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

const sitemapUrl = config.source.sitemap;
const origin = new URL(sitemapUrl).origin;
const prefix = config.source.projectPathPrefix || "/projects/";

let urls;
try {
  const xml = await get(sitemapUrl);
  urls = projectUrlsFromSitemap(xml, origin).filter((u) => new URL(u).pathname.startsWith(prefix));
} catch (err) {
  console.error("✖ No se pudo leer el sitemap. Se conservan los datos anteriores.", err.message);
  process.exit(1);
}
if (!urls.length) {
  console.error("✖ El sitemap no listó proyectos. Por seguridad no se cambia nada.");
  process.exit(1);
}

// Orden: el de la página de inicio de la fuente; lo que no aparezca allí va al final.
let order = [];
try {
  const home = await get(origin + "/");
  order = [...new Set([...home.matchAll(/href="\.?\/?(projects\/[^"#?]+)"/g)].map((m) => m[1].split("/").pop()))];
} catch { /* no es crítico */ }
const rank = (slug) => { const i = order.indexOf(slug); return i < 0 ? 1e6 : i; };

const projects = [];
const problems = [];
for (const url of urls) {
  const slug = url.replace(/\/+$/, "").split("/").pop();
  try {
    const p = parseProject(await get(url), url);
    const valid = p.address && (p.price || p.images.length) && p.status;
    if (!valid) throw new Error("faltan campos clave (dirección / precio / estado)");
    projects.push(p);
  } catch (err) {
    problems.push(`${slug}: ${err.message}`);
    if (prevBySlug.has(slug)) projects.push(prevBySlug.get(slug)); // conserva la versión anterior
  }
}
projects.sort((a, b) => rank(a.slug) - rank(b.slug));

const strip = (list) => JSON.stringify(list);
const changed = strip(projects) !== strip(previous.projects);
const added = projects.filter((p) => !prevBySlug.has(p.slug)).map((p) => p.slug);
const removed = previous.projects.filter((p) => !projects.some((q) => q.slug === p.slug)).map((p) => p.slug);

if (changed) {
  await writeFile(dataPath, JSON.stringify({ updatedAt: new Date().toISOString(), source: sitemapUrl, projects }, null, 2) + "\n");
}

console.log(`✔ ${projects.length} proyectos · ${changed ? "con cambios" : "sin cambios"}`);
if (added.length) console.log("  + nuevos:", added.join(", "));
if (removed.length) console.log("  − retirados:", removed.join(", "));
if (problems.length) {
  console.warn("⚠ Problemas al leer algunas páginas:\n  " + problems.join("\n  "));
  if (problems.length === urls.length) process.exit(1);
}
