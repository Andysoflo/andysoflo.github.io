// Parser sin dependencias para páginas de proyecto de broward.io (Framer).
// Funciona en Node y en el navegador (solo usa operaciones de texto).

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", hellip: "…", reg: "®", copy: "©", eacute: "é", aacute: "á", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ" };

export function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

function stripNoise(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

// Texto visible como lista de fragmentos, sin las repeticiones responsive de Framer.
export function textChunks(html) {
  const body = stripNoise(html).split(/<body[^>]*>/i).pop();
  const out = [];
  for (const raw of body.split(/<[^>]+>/)) {
    const t = decode(raw).replace(/\s+/g, " ").trim();
    if (t) out.push(t);
  }
  const seen = new Set(); // Framer repite bloques enteros para móvil/tablet/escritorio
  return out.filter((t, i) => {
    if (t === out[i - 1]) return false;
    if (t.length > 40) { if (seen.has(t)) return false; seen.add(t); }
    return true;
  });
}

function meta(html, key) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag ? decode(tag.match(/content=["']([^"']*)["']/i)?.[1] ?? "") : "";
}

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`, "i"));
  return m ? decode(m[1]) : "";
};

function images(html) {
  const seen = new Map();
  for (const tag of stripNoise(html).match(/<img\b[^>]*>/gi) ?? []) {
    const src = attr(tag, "src").split("?")[0];
    const alt = attr(tag, "alt");
    if (!src || !/framerusercontent\.com\/images\//.test(src)) continue;
    if (!alt || /logo|re\/?max|brokerage|agent|headshot/i.test(alt)) continue; // marca, no la propiedad
    if (!seen.has(src)) seen.set(src, alt);
  }
  return [...seen].map(([src, alt]) => ({ src, alt }));
}

const LABELS = {
  type: ["property type"],
  residences: ["residences"],
  beds: ["bedrooms", "beds"],
  price: ["price"],
  baths: ["bathrooms", "baths"],
  sqft: ["living area", "living area (sf)"],
  lot: ["lot size (sf)", "lot size"],
  garage: ["garage"],
  status: ["status"],
};

const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
};

export function parseProject(html, url) {
  const chunks = textChunks(html);
  const lower = chunks.map((c) => c.toLowerCase());
  const facts = {};
  for (const [key, names] of Object.entries(LABELS)) {
    const i = lower.findIndex((c) => names.includes(c));
    if (i >= 0 && i + 1 < chunks.length) facts[key] = chunks[i + 1];
  }

  const ogTitle = meta(html, "og:title");
  const address = (ogTitle.split(/\s[–—|-]\s/)[0] || "").trim();
  const headline = (ogTitle.split(/\s[–—]\s/)[1] || "").split("|")[0].trim();
  const description = meta(html, "description") || meta(html, "og:description");

  // Ciudad: fragmento que sigue a la dirección exacta; si no, la meta description.
  let city = "";
  const ai = chunks.indexOf(address);
  if (ai >= 0 && chunks[ai + 1] && chunks[ai + 1].length < 40) city = chunks[ai + 1];
  if (!city) city = description.match(/ in ([A-Z][A-Za-z .'-]+?),\s*FL/)?.[1] ?? "";

  // Resumen corto: primer párrafo largo después de la ciudad.
  const ci = city ? chunks.indexOf(city) : ai;
  const summary = chunks.slice(ci + 1, ci + 6).find((c) => c.length > 60) ?? description;

  // Descripción larga: entre "About this project" y "Gallery".
  const start = lower.indexOf("about this project");
  const end = lower.indexOf("gallery", start + 1);
  const about = start >= 0 ? chunks.slice(start + 1, end > start ? end : start + 8).filter((c) => c.length > 40 && c.toLowerCase() !== "about this project") : [];

  const slug = url.replace(/\/+$/, "").split("/").pop();
  return {
    slug,
    source: url,
    address,
    city,
    headline,
    type: facts.type ?? "",
    residences: facts.residences ?? "",
    status: facts.status ?? "",
    price: num(facts.price),
    priceLabel: facts.price ?? "",
    beds: num(facts.beds),
    baths: num(facts.baths),
    sqft: num(facts.sqft),
    lot: num(facts.lot),
    garage: num(facts.garage),
    summary,
    about,
    images: images(html),
  };
}

export function projectUrlsFromSitemap(xml, base) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)]
    .map((m) => decode(m[1]))
    .filter((u) => new URL(u, base).pathname.startsWith("/projects/"));
}
