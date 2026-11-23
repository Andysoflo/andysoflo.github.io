# andysoflo.com

Sitio de casas de obra nueva con la marca Andy SoFlo. Cada hora revisa broward.io, detecta las casas nuevas, los cambios de precio o estado y las que se retiran, y vuelve a publicar el sitio solo.

## Cómo funciona

```
broward.io/sitemap.xml ──► scripts/sync.mjs ──► data/projects.json ──► scripts/build.mjs ──► dist/ ──► GitHub Pages ──► www.andysoflo.com
         (cada hora, GitHub Actions)
```

- **Casa nueva en broward.io** → aparece en tu sitio en menos de una hora, con su propia página.
- **Cambio de precio, estado o fotos** → se actualiza en la siguiente sincronización.
- **Casa retirada del sitemap** → desaparece de tu sitio. Si alguien entra al enlace viejo, ve una página que lo manda a las casas disponibles.
- Las casas marcadas **Sold, Closed, Off Market o Withdrawn** se ocultan automáticamente (puedes cambiar la lista en `site.config.json` → `source.hideStatuses`).
- **Si broward.io falla o cambia de diseño**, no se borra nada: el sitio sigue mostrando la última versión buena y GitHub te avisa por correo de que la sincronización falló.

## 1. Tu marca

Ya está configurado con tu marca (logo AS, foto, colores y contacto). Para cambiar algo, edita `site.config.json`:

| Campo | Qué poner |
|---|---|
| `agent.name`, `agent.bio`, `agent.brokerage`, `agent.license` | Tus datos. La ley de Florida exige que el nombre del brokerage aparezca en la publicidad. |
| `agent.photo` | Ruta a tu foto, por ejemplo `/img/andy.jpg`. Pon el archivo en `src/public/img/andy.jpg`. |
| `brand.logo` | Ruta a tu logo (SVG o PNG), por ejemplo `/img/logo.svg`, en `src/public/img/`. Si lo dejas vacío, se usa el texto "ANDYSoFlo". |
| `contact.phone`, `contact.email` | Tu teléfono y correo. |
| `contact.whatsapp` | Tu número con código de país, solo dígitos: `13055551234`. Activa los botones de WhatsApp. |
| `contact.formEndpoint` | Opcional. Crea un formulario gratis en formspree.io y pega su URL para que los mensajes te lleguen al correo sin abrir la app de correo del visitante. |
| `theme` | Colores de la marca (hex). |

## 2. Súbelo a GitHub (una sola vez)

1. Crea un repositorio nuevo en github.com (por ejemplo `andysoflo-site`) y sube todo el contenido de esta carpeta.
2. En el repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Actions** → habilita los workflows si te lo pide → abre "Sincronizar casas y publicar" → **Run workflow**.
4. **Settings → Pages → Custom domain**: escribe `www.andysoflo.com` y guarda. Cuando aparezca el check, activa **Enforce HTTPS**.

## 3. Apunta tu dominio (andysoflo.com está hoy en Squarespace)

En Squarespace: **Domains → andysoflo.com → DNS settings**. Borra los registros de Squarespace que apuntan el dominio a la página "En construcción" y agrega estos:

| Tipo | Host | Valor |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | TU-USUARIO.github.io |

No toques los registros MX si usas correo con ese dominio. Los cambios de DNS tardan entre minutos y unas horas en propagarse.

## Comandos locales (opcional)

```bash
node scripts/sync.mjs    # trae lo último de broward.io
node scripts/build.mjs   # genera dist/
npx serve dist           # vista previa en http://localhost:3000
```

## Cambiar la fuente o la frecuencia

- Otra fuente u otro proyecto: `site.config.json` → `source.sitemap`. El lector (`scripts/parse.mjs`) espera páginas con las etiquetas de broward.io (Price, Bedrooms, Bathrooms, Living Area, Lot Size, Status).
- Frecuencia: `.github/workflows/sync-and-deploy.yml` → `cron`. `"17 * * * *"` es cada hora; `"*/30 * * * *"` es cada 30 minutos.

## Imágenes

Las fotos se cargan directamente desde el CDN de broward.io (framerusercontent.com). Así, cuando el desarrollador cambia una foto, cambia también en tu sitio, y si retira una casa sus fotos dejan de mostrarse.
