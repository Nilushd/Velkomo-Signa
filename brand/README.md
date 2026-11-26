# Velkomo Signa logo pack

**Velkomo Signa: forms and approvals, by Velkomo.**
The symbol is Velkomo's welcoming **V** figure on a blue tile. A cyan **approval tick** takes the place of Velkomo's gold spark: the form is signed and approved.
The lettering is Inter Display Bold, the same as the Velkomo wordmark, with **signa** in Signa blue.

| Folder | What's inside | Use it for |
|---|---|---|
| `svg/` | Vector originals | Website, print, signage |
| `png/logos/` | Logos 1000 px and 2000 px wide, transparent | Documents, slides |
| `png/icons/` | App icon and symbol, 128–1024 px | Square marks |
| `web/` | favicons, apple-touch, Android and maskable icons | The Signa web app (already copied to `public/`) |
| `social/` | Profile picture, share image, email-signature logo | Social, email |

Which logo: light backgrounds → `velkomo-signa-logo-horizontal` (or `-tagline`, `-stacked`); dark backgrounds → `-white`; one colour → `-mono-black` / `-mono-white`; small/app → `velkomo-signa-icon`.

Colours: Signa blue `#2563EB` · Bright blue `#2F6BFF` · Navy `#0B1F4D` · Approval cyan `#22D3EE` (on white: `#0891B2`) · Slate ink `#0F172A` · Mist `#F4F7FC`
Family: Velkomo = lagoon green + gold spark · Velkomo Watch = black + red live dot · **Velkomo Signa = blue + cyan tick**. Don't mix them.

Regenerate: `python3 source/make_svgs.py .` then `node source/render_png.js svg . jobs.json` (needs fontTools, Inter Display fonts and Playwright).
