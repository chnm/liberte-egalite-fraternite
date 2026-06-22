# liberte-egalite-fraternite

**Liberty, Equality, Fraternity: Exploring the French Revolution** — a static
(Hugo) rebuild of the Omeka Classic 3.0.1 site `revolution.chnm.org`.

## Overview

The content tree was generated from the site's MySQL dump with the
[`omeka-to-hugo`](../omeka-to-hugo) converter, then given a faithful
recreation of the original **Foundation 6.5.3** theme. Item URLs preserve the
live CleanUrl scheme (`/d/<identifier>`), the ExhibitBuilder exhibit is
reproduced page-for-page, and the original simple pages, tags, and navigation
are intact.

- **Items** → `/d/<identifier>/` (e.g. `/d/1/`); legacy `/items/show/<id>` and
  `/items/<id>/` are meta-refresh aliases.
- **Exhibit** → `/exhibits/show/liberty--equality--fraternity/<page>/`.
- **Simple pages** → `/faq/`, `/project-history/`, etc.
- **Search** → a [Pagefind](https://pagefind.app) index built over the whole
  site (the original server-side search is replaced by it).
- **Images / media** reference the live origin
  (`https://revolution.chnm.org/files/…`) rather than being vendored.

## Layout

```
content/      # generated Hugo content (items, exhibits, collections, pages)
layouts/      # faithful Foundation theme (hand-maintained — see caveat below)
static/
  css/app.css # vendored Foundation 6.5.3 stylesheet (original theme)
  css/a11y.css # WCAG 2.2 AA overrides layered on app.css
  img/, js/   # vendored theme assets
  uploads/    # site logo (theme_uploads)
omeka2hugo/   # converter artifacts (manifest, redirects, theme kit) — Hugo ignores
Dockerfile    # Hugo + Pagefind + Caddy build/serve image
```

## Build & deploy

Local build:

```sh
hugo --minify --baseURL https://revolution.chnm.org/
```

Container (build the Hugo site, generate the Pagefind index, serve with Caddy):

```sh
docker build --build-arg hugobuildargs="--minify --baseURL <url>" -t lef-revolution .
docker run -d -p 8080:80 lef-revolution
```

## Accessibility — WCAG 2.2 AA

The site targets **WCAG 2.2 Level AA**. An axe-core 4.11 audit (tags
`wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`) reports **0 violations** on the
representative page types — home, an item (`/d/1/`), an exhibit page, and a
simple page (`/faq/`). Specifics:

- Inline prose links are underlined (1.4.1 — not distinguished by color alone).
- Low-contrast grays were darkened to meet 1.4.3 (item-type subtitle; FAQ
  `.note`/`.bib`).
- Visible focus ring on all interactive elements; a working "skip to main
  content" link.
- The "About" nav dropdown is keyboard-operable (Foundation DropdownMenu:
  focusable toggle, opens on Enter, submenu items reachable).
- Header and exhibit sidebar are non-sticky, so a focused element is never
  obscured (2.4.11).

The contrast/link overrides live in `static/css/a11y.css`.

## Caveat: regenerating from the converter

The `omeka-to-hugo` converter refreshes `layouts/`, `archetypes/`, and `assets/`
from its own (utilitarian) `template-site/` on every run. The faithful Foundation
theme here is **hand-maintained in this repo** and is *not* reproduced by the
converter. Re-running the converter against a new dump will overwrite `layouts/`;
re-apply this theme (or restore `layouts/` from git) afterward. Generated
**content** (`content/`, `static/uploads/`, `omeka2hugo/`) is safe to regenerate.

## Deferred

- The NeatlineTime timeline (`/neatline-time/timelines/show/1`) is not yet
  rebuilt; the "Timeline" nav entry is omitted until it is.
