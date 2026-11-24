// Genera el sitio estático en dist/ a partir de site.config.json + data/projects.json.
// Uso: node scripts/build.mjs

import { readFile, writeFile, mkdir, rm, cp } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { DEAL_EXTRA_ES } from "./parse.mjs";

const root = new URL("..", import.meta.url);
const C = JSON.parse(await readFile(new URL("site.config.json", root), "utf8"));
const D = JSON.parse(await readFile(new URL("data/projects.json", root), "utf8"));
const dist = new URL("dist/", root);

const hide = (C.source.hideStatuses || []).map((s) => s.toLowerCase());
const projects = D.projects.filter((p) => !hide.includes(String(p.status).toLowerCase()));
const DL = existsSync(new URL("data/deals.json", root)) ? JSON.parse(readFileSync(new URL("data/deals.json", root), "utf8")) : { deals: [] };
const deals = C.offMarket?.enabled === false ? [] : DL.deals;

const ver = createHash("sha1").update(readFileSync(new URL("src/assets/site.css", root))).update(readFileSync(new URL("src/assets/site.js", root))).digest("hex").slice(0, 8);

// ---------- utilidades ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const t = (en, es, tag = "span") => `<${tag} data-es="${esc(es)}">${esc(en)}</${tag}>`;
const money = (n) => (n ? "$" + Math.round(n).toLocaleString("en-US") : "");
const n = (v) => (v == null ? "" : Number(v).toLocaleString("en-US"));
const img = (src, w = 1400) => (!src ? src : src.includes("framerusercontent.com") ? `${src}?scale-down-to=${w}` : src.includes("res.cloudinary.com") && src.includes("/upload/") ? src.replace("/upload/", `/upload/w_${w},c_limit,f_auto,q_auto/`) : src);
const wa = (msg) => (C.contact.whatsapp ? `https://wa.me/${C.contact.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}` : "");
const tel = (C.contact.phone.replace(/\D/g, "").length === 10 ? "+1" : "+") + C.contact.phone.replace(/\D/g, "");
const isPlaceholder = (s) => !s || /\[.*\]/.test(s);

const TYPE_ES = { "single-family home": "Casa unifamiliar", "single-family homes": "Casa unifamiliar", multifamily: "Multifamiliar", townhome: "Townhouse", townhomes: "Townhouses", condo: "Condominio", duplex: "Dúplex" };
const STATUS_ES = { active: "Disponible", "coming soon": "Próximamente", pending: "Bajo contrato", "under contract": "Bajo contrato", "pre-construction": "Preconstrucción", "under construction": "En construcción" };
const typeKey = (p) => (/multi/i.test(p.type) ? "multifamily" : /town/i.test(p.type) ? "townhome" : /condo/i.test(p.type) ? "condo" : "single");
const typeLabel = (p) => t(p.type.replace(/Homes$/, "Home"), TYPE_ES[p.type.toLowerCase()] || p.type);
const statusLabel = (p) => t(p.status, STATUS_ES[p.status.toLowerCase()] || p.status);
const updated = new Date(D.updatedAt);
const updatedEn = updated.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
const updatedEs = updated.toLocaleDateString("es-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
const siteUrl = `https://${C.domain}`;

// ---------- piezas comunes ----------
const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..800&family=Montserrat:ital,wght@0,500;0,600;0,700;1,500&display=swap" rel="stylesheet">`;
const themeVars = `<style>:root{--ink:${C.theme.ink};--paper:${C.theme.paper};--wash:${C.theme.wash};--canal:${C.theme.canal};--sun:${C.theme.sun};--mute:${C.theme.mute}}</style>`;

function head({ title, description, path = "/", image, noindex = false }) {
  return `<!DOCTYPE html><html lang="en" translate="no"><head><meta charset="utf-8"><meta name="google" content="notranslate"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${siteUrl}${path}">${noindex ? `<meta name="robots" content="noindex">` : ""}
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${siteUrl}${path}">${image ? `<meta property="og:image" content="${esc(img(image, 1200))}">` : ""}
<meta name="twitter:card" content="summary_large_image">${fonts}<link rel="stylesheet" href="/assets/site.css?v=${ver}">${themeVars}
<link rel="icon" type="image/png" href="${esc(C.brand.logo || "/favicon.png")}"></head>`;
}

const [wm1, wm2] = C.brand.wordmark || [C.brand.name, ""];
const logoFor = (src) => `${src ? `<img src="${esc(src)}" alt="" class="logo-img" width="52" height="37">` : ""}<span class="wordmark"><span>${esc(wm1)}&nbsp;<span class="wm-flo">${esc(wm2)}</span></span><small>${esc(C.brand.descriptor || "")}</small></span>`;
const logo = logoFor(C.brand.logo);
const logoDark = logoFor(C.brand.logoOnDark || C.brand.logo);

function nav(base = "") {
  return `<header class="nav"><div class="wrap nav-in">
<a href="/" class="brand" aria-label="${esc(C.brand.name)}">${logo}</a>
<nav aria-label="Main"><a href="${base}#homes">${t("New homes", "Obra nueva")}</a>${deals.length ? `<a href="/off-market/">Off market</a>` : ""}<a href="${base}#about">${t("About", "Sobre mí")}</a><a href="${base}#contact" class="nav-cta">${t("Contact", "Contacto")}</a>
<button class="lang" type="button" aria-label="Cambiar idioma / Change language">ES</button></nav></div></header>`;
}

function contactBlock(context = "", role = "Buyer") {
  const msg = context ? `Hi Andy! I'm interested in ${context}.` : "Hi Andy! I'd like information about new construction homes.";
  const waUrl = wa(msg);
  return `<form class="form" data-endpoint="${esc(C.contact.formEndpoint)}" data-email="${esc(C.contact.email)}" data-context="${esc(context)}">
<div class="row2"><label>${t("Name", "Nombre")}<input name="name" required autocomplete="name"></label>
<label>${t("Phone", "Teléfono")}<input name="phone" type="tel" autocomplete="tel"></label></div>
<label>Email<input name="email" type="email" required autocomplete="email"></label>
<fieldset><legend>${t("I'm a", "Soy")}</legend><div class="chips">
<label><input type="radio" name="role" value="Buyer"${role === "Buyer" ? " checked" : ""}>${t("Buyer", "Comprador")}</label>
<label><input type="radio" name="role" value="Investor"${role === "Investor" ? " checked" : ""}>${t("Investor", "Inversionista")}</label>
<label><input type="radio" name="role" value="Realtor">Realtor</label></div></fieldset>
<label>${t("Message", "Mensaje")}<textarea name="message" rows="4" data-es-placeholder="¿Qué buscas? Zona, presupuesto, fecha de mudanza…" placeholder="What are you looking for? Area, budget, move-in date…">${esc(context ? `I'd like details on ${context}.` : "")}</textarea></label>
<div class="form-actions"><button class="btn" type="submit">${t("Send message", "Enviar mensaje")}</button>
${waUrl ? `<a class="btn ghost" href="${waUrl}" target="_blank" rel="noopener">WhatsApp</a>` : ""}</div>
<p class="form-status" role="status" aria-live="polite"></p></form>`;
}

function footer() {
  const a = C.agent;
  return `<footer class="foot"><div class="wrap foot-in">
<div><a href="/" class="brand" aria-label="${esc(C.brand.name)}">${logoDark}</a><p class="foot-tag">${t(C.brand.tagline.en, C.brand.tagline.es)}</p></div>
<div class="foot-col"><p>${esc(a.name)}, ${esc(a.title.en)}<br>${esc(a.brokerage)}${a.license && !isPlaceholder(a.license) ? `<br>${esc(a.license)}` : ""}<br>${esc(a.areas || "")}</p></div>
<div class="foot-col"><p><a href="tel:${esc(tel)}">${esc(C.contact.phone)}</a><br><a href="mailto:${esc(C.contact.email)}">${esc(C.contact.email)}</a>${C.contact.instagram ? `<br><a href="https://instagram.com/${esc(C.contact.instagram.replace("@", ""))}" target="_blank" rel="noopener">Instagram</a>` : ""}</p></div>
</div><div class="wrap foot-legal"><p>${esc(C.source.listingCourtesy)}. ${t("Prices, availability and features may change without notice. Information deemed reliable but not guaranteed.", "Precios, disponibilidad y características pueden cambiar sin aviso. Información confiable pero no garantizada.")}</p>
<p>${t(`Listings updated ${updatedEn}.`, `Propiedades actualizadas el ${updatedEs}.`)} © ${new Date().getFullYear()} ${esc(C.brand.name)}.</p></div></footer>
<script src="/assets/site.js?v=${ver}" defer></script></body></html>`;
}

const facts = (p) => [
  p.beds != null && [t("Bedrooms", "Habitaciones"), n(p.beds)],
  p.baths != null && [t("Bathrooms", "Baños"), n(p.baths)],
  p.sqft && [t("Living area", "Área habitable"), `${n(p.sqft)} sf`],
  p.lot && [t("Lot", "Terreno"), `${n(p.lot)} sf`],
  p.garage && [t("Garage", "Garaje"), n(p.garage)],
  p.residences && [t("Residences", "Residencias"), t(p.residences, p.residences.replace(/Homes?|Residences?/i, (m) => (/s$/.test(m) ? "casas" : "casa")).replace(/Units/i, "unidades"))],
].filter(Boolean);

const specLine = (p) => [p.beds != null && `${n(p.beds)} bd`, p.baths != null && `${n(p.baths)} ba`, p.sqft && `${n(p.sqft)} sf`].filter(Boolean).join("  /  ");

// ---------- off market ----------
const DTYPE_ES = { "single family": "Unifamiliar", condo: "Condominio", "multi-family": "Multifamiliar", townhouse: "Townhouse", land: "Terreno", commercial: "Comercial" };
const dealKey = (d) => (/multi|duplex|triplex/i.test(d.type) ? "multifamily" : /condo|town/i.test(d.type) ? "condo" : /land|lot/i.test(d.type) ? "land" : "single");
const dealType = (d) => t(d.type || "Property", DTYPE_ES[String(d.type).toLowerCase()] || d.type || "Propiedad");
const dealSpec = (d) => [d.beds != null && `${n(d.beds)} bd`, d.baths != null && `${n(d.baths)} ba`, d.sqft && `${n(d.sqft)} sf`, d.lot && `${n(d.lot)} sf lot`, d.year && `built ${d.year}`].filter(Boolean).join("  /  ");
const extraLabel = (x) => { const en = x.label.charAt(0) + x.label.slice(1).toLowerCase(); return t(en, DEAL_EXTRA_ES[x.label] || en); };
const dealTags = (d) => {
  const ex = Object.fromEntries(d.extras.map((x) => [x.label, x.value]));
  return [
    d.pool && t("Pool", "Piscina"),
    ex["RENTAL INCOME"] && t(`Rent ${ex["RENTAL INCOME"]}/mo`, `Renta ${ex["RENTAL INCOME"]}/mes`),
    ex["TENANT STATUS"] && ex["TENANT STATUS"].length <= 32 && esc(ex["TENANT STATUS"]),
    ex["ZONING"] && t(`Zoning ${ex["ZONING"]}`, `Zonificación ${ex["ZONING"]}`),
    /seller financing/i.test(d.notes) && t("Seller financing", "Financiamiento del vendedor"),
    /55\+/.test(d.notes) && t("55+ community", "Comunidad 55+"),
  ].filter(Boolean).slice(0, 3);
};
const disclosure = () => t(
  "Off-market deals are usually offered through an assignment of contract: the party offering the deal holds an equitable interest in the property and is not the owner of record. Details come from third parties; verify them before you buy. Price and availability can change at any time.",
  "Los deals off market normalmente se ofrecen como cesión de contrato (assignment): quien ofrece el deal tiene un interés equitativo sobre la propiedad y no es el dueño registrado. Los datos vienen de terceros; verifícalos antes de comprar. Precio y disponibilidad pueden cambiar en cualquier momento.", "p");

function dealCard(d) {
  const tags = dealTags(d);
  const ph = d.images?.[0];
  return `<article class="deal${ph ? " has-img" : ""}" data-type="${dealKey(d)}" data-price="${d.price || 0}"><a href="/off-market/${d.slug}/" class="deal-link">
${ph ? `<div class="deal-img"><img src="${esc(img(ph.src, 800))}" alt="${esc(ph.alt)}" loading="lazy" width="800" height="533"><span class="status">Off market</span></div>` : ""}
<div class="deal-body"><p class="deal-meta">${dealType(d)}, ${esc(d.county ? d.county + " County" : d.city)}</p>
<h3>${esc(d.address)}</h3><p class="deal-city">${esc(d.city)}, FL ${esc(d.zip)}</p>
<p class="deal-price">${money(d.price)}</p>
<p class="card-spec">${dealSpec(d)}</p>
${tags.length ? `<p class="deal-tags">${tags.map((x) => `<span>${x}</span>`).join("")}</p>` : ""}
</div></a></article>`;
}

function offMarketPage() {
  const keys = [...new Set(deals.map(dealKey))];
  const counties = [...new Set(deals.map((d) => d.county).filter(Boolean))];
  const label = { single: t("Single-family", "Unifamiliares"), condo: t("Condos", "Condominios"), multifamily: t("Multi-family", "Multifamiliares"), land: t("Land", "Terrenos") };
  return `${head({ title: `Off-market deals in South Florida | ${C.brand.name}`, description: `Off-market investment properties in ${counties.join(", ")}. Contact ${C.agent.name} for the full deal package.`, path: "/off-market/", noindex: true })}<body>
${nav("/")}
<main>
<section class="om-hero"><div class="wrap">
${t("Off-market deals", "Deals off market", "h1")}
${t(`${deals.length} investment properties that aren't on the MLS, across ${counties.join(", ")}. They move fast: ask for the full package before you make an offer.`, `${deals.length} propiedades de inversión que no están en el MLS, en ${counties.join(", ")}. Se venden rápido: pide el paquete completo antes de ofertar.`, "p")}
</div></section>
<section class="homes om-list"><div class="wrap">
<div class="sec-head"><div class="filters" role="group" aria-label="Filter">
<button type="button" class="chip" aria-pressed="true" data-filter="all">${t("All", "Todos")} <span class="count">${deals.length}</span></button>
${keys.map((k) => `<button type="button" class="chip" aria-pressed="false" data-filter="${k}">${label[k]}</button>`).join("")}
<label class="sort">${t("Sort", "Ordenar")} <select id="sort"><option value="featured" data-es="Más recientes">Newest</option><option value="asc" data-es="Precio: menor a mayor">Price: low to high</option><option value="desc" data-es="Precio: mayor a menor">Price: high to low</option></select></label>
</div></div>
<div class="deal-grid" id="grid">${deals.map(dealCard).join("")}</div>
<p class="empty" hidden>${t("No deals match this filter right now. Tell me your buy box and I'll send matches as they come in.", "No hay deals con este filtro ahora mismo. Dime qué buscas y te envío los que encajen apenas lleguen.")}</p>
<div class="om-note">${disclosure()}</div>
</div></section>
<section id="contact" class="contact"><div class="wrap contact-in">
<div>${t("Tell me your buy box", "Dime qué estás buscando", "h2")}
${t("Area, budget, property type and how you're paying. I'll send you new off-market deals that fit before they're gone.", "Zona, presupuesto, tipo de propiedad y forma de pago. Te envío los nuevos deals off market que encajen antes de que se vayan.", "p")}
<p class="direct"><a href="tel:${esc(tel)}">${esc(C.contact.phone)}</a><br><a href="mailto:${esc(C.contact.email)}">${esc(C.contact.email)}</a></p></div>
${contactBlock("", "Investor")}</div></section>
</main>
${footer()}`;
}

function dealPage(d) {
  const ctx = `the off-market deal at ${d.address}, ${d.city}`;
  const waUrl = wa(`Hi Andy! I'm interested in ${ctx}.`);
  const rows = [
    d.beds != null && [t("Bedrooms", "Habitaciones"), n(d.beds)],
    d.baths != null && [t("Bathrooms", "Baños"), n(d.baths)],
    d.sqft && [t("Living area", "Área habitable"), `${n(d.sqft)} sf`],
    d.lot && [t("Lot", "Terreno"), `${n(d.lot)} sf`],
    d.year && [t("Year built", "Año"), String(d.year)],
    d.pool != null && [t("Pool", "Piscina"), d.pool ? t("Yes", "Sí") : "No"],
    d.parking && [t("Parking", "Estacionamiento"), esc(d.parking)],
    d.county && [t("County", "Condado"), esc(d.county)],
  ].filter(Boolean);
  const others = deals.filter((x) => x.slug !== d.slug).slice(0, 3);
  return `${head({ title: `${d.address}, ${d.city} off-market deal | ${C.brand.name}`, description: `${d.type} in ${d.city}, FL. ${money(d.price)}. ${d.notes}`.slice(0, 300), path: `/off-market/${d.slug}/`, noindex: true })}<body>
${nav("/")}
<main class="pp">
<div class="wrap"><a href="/off-market/" class="back">${t("All off-market deals", "Todos los deals off market")}</a></div>
${d.images?.length ? `<section class="wrap deal-photo"><figure class="pp-main"><img id="ppMain" src="${esc(img(d.images[0].src, 1800))}" alt="${esc(d.images[0].alt)}"></figure>
${d.images.length > 1 ? `<div class="thumbs">${d.images.map((im, i) => `<button type="button" class="thumb" data-src="${esc(img(im.src, 1800))}" data-alt="${esc(im.alt)}" aria-label="Photo ${i + 1}"${i === 0 ? ' aria-current="true"' : ""}><img src="${esc(img(im.src, 300))}" alt=""></button>`).join("")}</div>` : ""}</section>` : ""}
<section class="wrap pp-top deal-top">
<div class="deal-sheet">
<p class="card-type">${dealType(d)}, ${esc(d.county ? d.county + " County" : "")} <span class="status inline">Off market</span></p>
<h1>${esc(d.address)}</h1>
<p class="deal-city">${esc(d.city)}, FL ${esc(d.zip)}</p>
<p class="deal-price deal-price-m">${money(d.price)}</p>
<dl class="facts">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
${d.extras.length ? `<dl class="extras">${d.extras.map((x) => `<div><dt>${extraLabel(x)}</dt><dd>${esc(x.value)}</dd></div>`).join("")}</dl>` : ""}
${d.notes ? `${t("Deal notes", "Notas del deal", "h2")}<p class="deal-notes">${esc(d.notes)}</p>` : ""}
</div>
<aside class="pp-side">
<p class="pp-price">${money(d.price)}</p>
${t("Asking price. Send proof of funds or a pre-approval to request access and the full package.", "Precio de venta. Envía prueba de fondos o pre-aprobación para pedir acceso y el paquete completo.", "p")}
<div class="pp-cta"><a class="btn" href="#ask">${t("Request this deal", "Pedir este deal")}</a>${waUrl ? `<a class="btn ghost" href="${waUrl}" target="_blank" rel="noopener">WhatsApp</a>` : `<a class="btn ghost" href="tel:${esc(tel)}">${t("Call", "Llamar")}</a>`}</div>
${d.photos ? `<p class="photos-link"><a href="${esc(d.photos)}" target="_blank" rel="noopener">${t("See photos", "Ver fotos")}</a></p>` : ""}
<div class="om-note">${disclosure()}</div>
</aside></section>
<section class="wrap deal-ask">
<div id="ask" class="pp-form">${t("Ask about this deal", "Pregunta por este deal", "h2")}${contactBlock(`${d.address}, ${d.city} (off market)`, "Investor")}</div>
</section>
${others.length ? `<section class="wrap more">${t("More off-market deals", "Más deals off market", "h2")}<div class="deal-grid">${others.map(dealCard).join("")}</div></section>` : ""}
</main>
${footer()}`;
}

function offMarketTeaser() {
  if (!deals.length) return "";
  return `<section id="off-market" class="om-teaser"><div class="wrap">
<div class="sec-head"><div>${t("Off-market deals", "Deals off market", "h2")}${t(`Investment properties that aren't on the MLS. ${deals.length} available now.`, `Propiedades de inversión que no están en el MLS. ${deals.length} disponibles ahora.`, "p")}</div>
<a class="btn ghost" href="/off-market/">${t(`See all ${deals.length} deals`, `Ver los ${deals.length} deals`)}</a></div>
<div class="deal-grid">${deals.slice(0, 3).map(dealCard).join("")}</div></div></section>`;
}

// ---------- inicio ----------
function homePage() {
  const cities = [...new Map(projects.map((p) => [p.city, projects.filter((q) => q.city === p.city).length]))];
  const minPrice = Math.min(...projects.filter((p) => p.price && typeKey(p) !== "multifamily").map((p) => p.price));
  const types = [...new Set(projects.map(typeKey))];
  const first = projects[0];

  const directory = projects.map((p, i) => `<li><a href="/homes/${p.slug}/" data-img="${esc(img(p.images[0]?.src, 1600))}" data-alt="${esc(p.images[0]?.alt || p.address)}"${i === 0 ? ' aria-current="true"' : ""}>
<span class="d-addr">${esc(p.address)}</span><span class="d-city">${esc(p.city)}</span><span class="d-price">${money(p.price) || t("Inquire", "Consultar")}</span></a></li>`).join("");

  const cards = projects.map((p) => `<article class="card" data-type="${typeKey(p)}" data-city="${esc(p.city)}" data-price="${p.price || 0}">
<a href="/homes/${p.slug}/" class="card-link">
<div class="card-img"><img src="${esc(img(p.images[0]?.src, 900))}" alt="${esc(p.images[0]?.alt || p.address)}" loading="lazy" width="900" height="600"><span class="status">${statusLabel(p)}</span></div>
<div class="card-body"><p class="card-type">${typeLabel(p)}, ${esc(p.city)}</p><h3>${esc(p.address)}</h3>
<p class="card-spec">${specLine(p)}</p><p class="card-price">${money(p.price) || t("Price on request", "Precio a consultar")}${typeKey(p) === "multifamily" && p.residences ? ` <small>${t("entire property, " + p.residences.toLowerCase(), "propiedad completa, " + p.residences.toLowerCase().replace("units", "unidades"))}</small>` : ""}</p></div></a></article>`).join("");

  const why = [
    ["Built to today's code", "Construida con el código actual", "Impact windows, modern wiring and current wind standards, which can help with insurance costs.", "Ventanas de impacto, instalaciones modernas y normas de viento actuales, lo que puede ayudar con el costo del seguro."],
    ["Nothing to fix first", "Nada que arreglar primero", "New roof, A/C and appliances mean fewer surprise repairs in the first years.", "Techo, aire acondicionado y electrodomésticos nuevos: menos reparaciones inesperadas en los primeros años."],
    ["Builder warranties", "Garantías del constructor", "Most new homes include warranty coverage on structure and systems. I'll walk you through what each one covers.", "La mayoría incluye garantía sobre estructura y sistemas. Te explico qué cubre cada una."],
    ["Incentives that change", "Incentivos que cambian", "Closing-cost credits and preferred-lender programs come and go. I track them for every home on this page.", "Créditos para gastos de cierre y programas con prestamistas preferidos cambian seguido. Los sigo en cada casa de esta página."],
  ].map(([he, hs, be, bs]) => `<div class="why-item">${t(he, hs, "h3")}${t(be, bs, "p")}</div>`).join("");

  const a = C.agent;
  const agentPhoto = a.photo ? `<img src="${esc(a.photo)}" alt="${esc(a.name)}" class="agent-photo">` : `<div class="agent-photo agent-ph" aria-hidden="true"></div>`;

  return `${head({ title: `${C.brand.name}: New construction homes in South Florida`, description: `New construction homes in Broward and Miami-Dade with ${C.agent.name}, ${C.agent.title.en} at ${C.agent.brokerage}. ${C.brand.tagline.en}`, image: first?.images[0]?.src })}<body>
${nav()}
<main>
<section class="hero"><div class="wrap hero-in">
<div class="hero-copy">
<h1>${t("New homes you can tour this week in South Florida.", "Casas nuevas que puedes visitar esta semana en el sur de Florida.")}</h1>
<p class="lede">${t(`${projects.length} homes available now${minPrice < Infinity ? `, from ${money(minPrice)}` : ""}. Pick an address to see it.`, `${projects.length} casas disponibles ahora${minPrice < Infinity ? `, desde ${money(minPrice)}` : ""}. Elige una dirección para verla.`)}</p>
<ol class="directory" aria-label="Available addresses">${directory}</ol>
</div>
<figure class="hero-photo"><img src="${esc(img(first?.images[0]?.src, 1600))}" alt="${esc(first?.images[0]?.alt || "")}" id="heroImg" fetchpriority="high"></figure>
</div></section>

<section id="homes" class="homes"><div class="wrap">
<div class="sec-head">${t("Available homes", "Casas disponibles", "h2")}
<div class="filters" role="group" aria-label="Filter">
<button type="button" class="chip" aria-pressed="true" data-filter="all">${t("All", "Todas")} <span class="count">${projects.length}</span></button>
${types.includes("single") ? `<button type="button" class="chip" aria-pressed="false" data-filter="single">${t("Single-family", "Unifamiliares")}</button>` : ""}
${types.includes("townhome") ? `<button type="button" class="chip" aria-pressed="false" data-filter="townhome">Townhomes</button>` : ""}
${types.includes("multifamily") ? `<button type="button" class="chip" aria-pressed="false" data-filter="multifamily">${t("Investment", "Inversión")}</button>` : ""}
<label class="sort">${t("Sort", "Ordenar")} <select id="sort"><option value="featured" data-es="Destacadas">Featured</option><option value="asc" data-es="Precio: menor a mayor">Price: low to high</option><option value="desc" data-es="Precio: mayor a menor">Price: high to low</option></select></label>
</div></div>
<div class="grid" id="grid">${cards}</div>
<p class="empty" hidden>${t("No homes match this filter right now. Ask me about what's coming next.", "No hay casas con este filtro ahora mismo. Pregúntame por lo que viene.")}</p>
</div></section>

${offMarketTeaser()}

<section class="why"><div class="wrap why-in">
${t("Why buy new", "Por qué comprar nuevo", "h2")}
<div class="why-list">${why}</div></div></section>

<section id="about" class="about"><div class="wrap about-in">${agentPhoto}
<div><h2>${esc(a.name)}</h2><p class="agent-title">${t(a.title.en, a.title.es)}, ${esc(a.brokerage)}<br>${esc(a.areas || "")}</p>${t(a.bio.en, a.bio.es, "p")}
<p class="agent-lang">${esc(a.languages)}</p>
<div class="areas">${cities.map(([c, k]) => `<span>${esc(c)} <b>${k}</b></span>`).join("")}</div></div></div></section>

<section id="contact" class="contact"><div class="wrap contact-in">
<div>${t("Ask about a home or book a tour", "Pregunta por una casa o agenda una visita", "h2")}
${t("I reply the same day with availability, floor plans and current incentives.", "Respondo el mismo día con disponibilidad, planos e incentivos vigentes.", "p")}
<p class="direct"><a href="tel:${esc(tel)}">${esc(C.contact.phone)}</a><br><a href="mailto:${esc(C.contact.email)}">${esc(C.contact.email)}</a></p></div>
${contactBlock()}</div></section>
</main>
${footer()}`;
}

// ---------- página de cada casa ----------
function projectPage(p) {
  const gallery = p.images.map((im, i) => `<button type="button" class="thumb" data-src="${esc(img(im.src, 1800))}" data-alt="${esc(im.alt)}" aria-label="Photo ${i + 1}"${i === 0 ? ' aria-current="true"' : ""}><img src="${esc(img(im.src, 300))}" alt=""></button>`).join("");
  const ld = { "@context": "https://schema.org", "@type": "SingleFamilyResidence", name: p.address, address: { "@type": "PostalAddress", streetAddress: p.address, addressLocality: p.city, addressRegion: "FL", addressCountry: "US" }, numberOfRooms: p.beds, floorSize: p.sqft ? { "@type": "QuantitativeValue", value: p.sqft, unitCode: "FTK" } : undefined, image: p.images.map((i) => i.src) };
  const others = projects.filter((q) => q.slug !== p.slug).slice(0, 3);
  return `${head({ title: `${p.address}, ${p.city} | ${C.brand.name}`, description: p.summary, path: `/homes/${p.slug}/`, image: p.images[0]?.src })}<body>
${nav("/")}
<main class="pp">
<div class="wrap"><a href="/#homes" class="back">${t("All homes", "Todas las casas")}</a></div>
<section class="wrap pp-top">
<div class="pp-gallery"><figure class="pp-main"><img id="ppMain" src="${esc(img(p.images[0]?.src, 1800))}" alt="${esc(p.images[0]?.alt || p.address)}"></figure>
${p.images.length > 1 ? `<div class="thumbs">${gallery}</div>` : ""}</div>
<aside class="pp-side">
<p class="card-type">${typeLabel(p)}, ${esc(p.city)} <span class="status inline">${statusLabel(p)}</span></p>
<h1>${esc(p.address)}</h1>
<p class="pp-price">${money(p.price) || t("Price on request", "Precio a consultar")}</p>
${typeKey(p) === "multifamily" ? `<p class="note">${t("Price is for the entire property; specs below are per unit.", "El precio es por la propiedad completa; los datos de abajo son por unidad.")}</p>` : ""}
<dl class="facts">${facts(p).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
<div class="pp-cta"><a class="btn" href="#ask">${t("Request info", "Pedir información")}</a>${wa(`Hi! I'm interested in ${p.address}, ${p.city}.`) ? `<a class="btn ghost" href="${wa(`Hi! I'm interested in ${p.address}, ${p.city}.`)}" target="_blank" rel="noopener">WhatsApp</a>` : `<a class="btn ghost" href="tel:${esc(tel)}">${t("Call", "Llamar")}</a>`}</div>
</aside></section>

<section class="wrap pp-body">
<div class="pp-about">${t("About this home", "Sobre esta casa", "h2")}<p class="pp-summary">${esc(p.summary)}</p>${p.about.map((x) => `<p>${esc(x)}</p>`).join("")}
<p class="courtesy">${esc(C.source.listingCourtesy)}.</p></div>
<div id="ask" class="pp-form">${t("Ask about this home", "Pregunta por esta casa", "h2")}${contactBlock(`${p.address}, ${p.city}`)}</div>
</section>

${others.length ? `<section class="wrap more">${t("Also available", "También disponibles", "h2")}<div class="grid small">${others.map((q) => `<article class="card"><a class="card-link" href="/homes/${q.slug}/"><div class="card-img"><img src="${esc(img(q.images[0]?.src, 700))}" alt="${esc(q.images[0]?.alt || q.address)}" loading="lazy"></div><div class="card-body"><h3>${esc(q.address)}</h3><p class="card-spec">${specLine(q)}</p><p class="card-price">${money(q.price)}</p></div></a></article>`).join("")}</div></section>` : ""}
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
</main>
${footer()}`;
}

// ---------- escribir ----------
await rm(dist, { recursive: true, force: true });
await mkdir(new URL("assets/", dist), { recursive: true });
await cp(new URL("src/assets/", root), new URL("assets/", dist), { recursive: true });
if (existsSync(new URL("src/public/", root))) await cp(new URL("src/public/", root), dist, { recursive: true });

await writeFile(new URL("index.html", dist), homePage());
for (const p of projects) {
  const dir = new URL(`homes/${p.slug}/`, dist);
  await mkdir(dir, { recursive: true });
  await writeFile(new URL("index.html", dir), projectPage(p));
}
if (deals.length) {
  await mkdir(new URL("off-market/", dist), { recursive: true });
  await writeFile(new URL("off-market/index.html", dist), offMarketPage());
  for (const d of deals) {
    const dir = new URL(`off-market/${d.slug}/`, dist);
    await mkdir(dir, { recursive: true });
    await writeFile(new URL("index.html", dir), dealPage(d));
  }
}
await writeFile(new URL("404.html", dist), `${head({ title: `Page not found | ${C.brand.name}`, description: "" })}<body>${nav("/")}<main class="wrap notfound">${t("This property is no longer listed.", "Esta propiedad ya no está publicada.", "h1")}${t("It may have sold. Here's everything available today:", "Puede que se haya vendido. Esto es lo disponible hoy:", "p")}<p class="pp-cta"><a class="btn" href="/#homes">${t("New homes", "Obra nueva")}</a>${deals.length ? `<a class="btn ghost" href="/off-market/">Off market</a>` : ""}</p></main>${footer()}`);
await writeFile(new URL("CNAME", dist), C.domain + "\n");
await writeFile(new URL("robots.txt", dist), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
await writeFile(new URL("sitemap.xml", dist), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["/", ...projects.map((p) => `/homes/${p.slug}/`)].map((u) => `<url><loc>${siteUrl}${u}</loc><lastmod>${D.updatedAt.slice(0, 10)}</lastmod></url>`).join("\n")}\n</urlset>\n`);
await writeFile(new URL("projects.json", dist), JSON.stringify({ updatedAt: D.updatedAt, projects }, null, 2));

const todo = ["agent.name", "agent.brokerage", "contact.phone", "contact.email"].filter((k) => isPlaceholder(k.split(".").reduce((o, x) => o[x], C)));
console.log(`✔ Sitio generado en dist/ con ${projects.length} casas y ${deals.length} deals off market.`);
if (todo.length) console.warn("⚠ Falta completar en site.config.json:", todo.join(", "));
