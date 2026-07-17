# Deploying pscope.site

The whole site is static files - this repository is the deployable unit. No
build step, no dependencies.

```
/                index.html, styles.css, theme.js, page.js, sim.js, figures.js,
                 resume.pdf, 404.html
/orbit-wars/     playable game vs the ah_mild agent port
/neurogolf/      400-network showcase (data.js holds the mined statistics)
/atrium/  /sovereign/  /laurel/    project field sheets
/aural/          live spatial-audio app
```

## Cloudflare Pages (Git-connected)

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**
   → select `soy-praveen/portfolio`.
2. Build settings: framework preset **None**, build command **empty**,
   build output directory **`/`**.
3. Every push to `main` deploys automatically. The site is immediately live at
   `<project>.pages.dev`.

## Custom domain: pscope.site (registered at Spaceship)

Cloudflare Pages needs the domain's DNS on Cloudflare:

1. Cloudflare dashboard → **Add a domain** → `pscope.site` → Free plan.
   Cloudflare shows two nameservers (e.g. `xxx.ns.cloudflare.com`).
2. Spaceship dashboard → pscope.site → **Nameservers** → switch from Spaceship
   DNS to **custom nameservers** and paste the two Cloudflare ones.
   (Spaceship remains the registrar; only DNS moves.)
3. Wait for the zone to go **Active** in Cloudflare (minutes to a few hours).
4. Pages project → **Custom domains → Set up a domain** → `pscope.site`
   (and again for `www.pscope.site` if wanted). DNS records and SSL are
   created automatically.

Nothing else to renew or pay - Pages is free with unlimited static bandwidth.
