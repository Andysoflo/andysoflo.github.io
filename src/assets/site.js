(() => {
  // ---------- idioma (EN por defecto; ES si el navegador está en español o el usuario lo eligió) ----------
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  const nodes = [...document.querySelectorAll("[data-es]")];
  const phs = [...document.querySelectorAll("[data-es-placeholder]")];
  nodes.forEach((el) => (el.dataset.en = el.textContent));
  phs.forEach((el) => (el.dataset.enPlaceholder = el.placeholder));
  const btn = document.querySelector(".lang");
  function setLang(lang) {
    document.documentElement.lang = lang;
    nodes.forEach((el) => (el.textContent = lang === "es" ? el.dataset.es : el.dataset.en));
    phs.forEach((el) => (el.placeholder = lang === "es" ? el.dataset.esPlaceholder : el.dataset.enPlaceholder));
    if (btn) btn.textContent = lang === "es" ? "EN" : "ES";
    store.set("lang", lang);
  }
  const langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""]).map((l) => l.toLowerCase());
  const initial = store.get("lang") || (langs[0].startsWith("es") || (langs.some((l) => l.startsWith("es")) && !langs[0].startsWith("en")) ? "es" : "en");
  if (initial === "es") setLang("es");
  btn?.addEventListener("click", () => setLang(document.documentElement.lang === "es" ? "en" : "es"));

  // ---------- hero: la foto cambia según la dirección ----------
  const heroImg = document.getElementById("heroImg");
  const dir = document.querySelectorAll(".directory a");
  let swapTimer;
  function show(a) {
    if (!heroImg || a.getAttribute("aria-current") === "true") return;
    dir.forEach((x) => x.removeAttribute("aria-current"));
    a.setAttribute("aria-current", "true");
    clearTimeout(swapTimer);
    heroImg.classList.add("swap");
    swapTimer = setTimeout(() => { heroImg.src = a.dataset.img; heroImg.alt = a.dataset.alt; heroImg.onload = () => heroImg.classList.remove("swap"); }, 180);
  }
  dir.forEach((a) => { a.addEventListener("mouseenter", () => show(a)); a.addEventListener("focus", () => show(a)); new Image().src = a.dataset.img; });

  // ---------- filtros y orden ----------
  const grid = document.getElementById("grid");
  if (grid) {
    const cards = [...grid.children];
    const chips = document.querySelectorAll(".chip[data-filter]");
    const sort = document.getElementById("sort");
    const empty = document.querySelector(".empty");
    let filter = "all";
    const apply = () => {
      let shown = 0;
      cards.forEach((c) => { const ok = filter === "all" || c.dataset.type === filter; c.hidden = !ok; if (ok) shown++; });
      const mode = sort.value;
      const ordered = mode === "featured" ? cards : [...cards].sort((a, b) => (mode === "asc" ? 1 : -1) * ((+a.dataset.price || Infinity) - (+b.dataset.price || Infinity)));
      ordered.forEach((c) => grid.appendChild(c));
      empty.hidden = shown > 0;
    };
    chips.forEach((c) => c.addEventListener("click", () => { filter = c.dataset.filter; chips.forEach((x) => x.setAttribute("aria-pressed", x === c)); apply(); }));
    sort.addEventListener("change", apply);
  }

  // ---------- galería ----------
  const main = document.getElementById("ppMain");
  document.querySelectorAll(".thumb").forEach((t) => t.addEventListener("click", () => {
    main.src = t.dataset.src; main.alt = t.dataset.alt;
    document.querySelectorAll(".thumb").forEach((x) => x.removeAttribute("aria-current"));
    t.setAttribute("aria-current", "true");
  }));

  // ---------- formulario ----------
  document.querySelectorAll("form.form").forEach((form) => form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const es = document.documentElement.lang === "es";
    const status = form.querySelector(".form-status");
    const data = Object.fromEntries(new FormData(form));
    if (form.dataset.context) data.property = form.dataset.context;
    data.page = location.href;
    if (form.dataset.endpoint) {
      status.className = "form-status"; status.textContent = es ? "Enviando…" : "Sending…";
      try {
        const r = await fetch(form.dataset.endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) });
        if (!r.ok) throw new Error(r.status);
        form.reset();
        status.className = "form-status ok"; status.textContent = es ? "Mensaje enviado. Te respondo hoy mismo." : "Message sent. I'll get back to you today.";
      } catch {
        status.className = "form-status err"; status.textContent = es ? "No se pudo enviar. Escríbeme por correo o WhatsApp." : "The message didn't go through. Email or WhatsApp me instead.";
      }
    } else {
      const subject = data.property ? `Inquiry: ${data.property}` : "New construction inquiry";
      const body = `Name: ${data.name}\nPhone: ${data.phone || "-"}\nEmail: ${data.email}\nI'm a: ${data.role}\n\n${data.message || ""}\n\n${data.page}`;
      location.href = `mailto:${form.dataset.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      status.className = "form-status ok"; status.textContent = es ? "Se abrió tu correo con el mensaje listo para enviar." : "Your email app opened with the message ready to send.";
    }
  }));
})();
