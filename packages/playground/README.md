# XVML Playground

Web-based editor with live preview for `.xvml` files.

## Run locally

```bash
cd packages/playground
npm install
npm run dev
```

Opens at `http://localhost:5173`

## Build

```bash
cd packages/playground
npm install
npm run build
# Static output → packages/playground/dist/
```

The output in `dist/` is a fully static site (HTML + JS + CSS). No server required — deploy it anywhere that serves static files.

---

## Deploy

### Vercel

```bash
npm install -g vercel
cd packages/playground
vercel --prod
```

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Install command:** `npm install`

### Cloudflare Pages

1. Connect your GitHub repo in the Cloudflare Pages dashboard
2. Set root directory to `packages/playground`
3. Build command: `npm run build`
4. Output directory: `dist`

### Render

1. New → Static Site → connect GitHub repo
2. Root directory: `packages/playground`
3. Build command: `npm run build`
4. Publish directory: `dist`

### Railway

1. New project → Deploy from GitHub
2. Set root directory: `packages/playground`
3. Build command: `npm run build`
4. Start command: *(leave empty — Railway serves static sites automatically)*
5. Or use `npx serve dist` as the start command

### GitHub Pages

```bash
cd packages/playground
npm run build
# Copy dist/ contents to your gh-pages branch, or use the gh-pages package:
npx gh-pages -d dist
```

### Any static host (S3, Nginx, Caddy, etc.)

Run `npm run build`, then serve the `dist/` folder as a static directory. No special server config needed — the app is entirely client-side.

---

## Custom domain (xvml-lang.dev)

After deploying, add the domain in your hosting provider's dashboard, then configure DNS at your registrar:

| Host provider | DNS record |
|---|---|
| Vercel | `A @ 76.76.21.21` + `CNAME www cname.vercel-dns.com` |
| Cloudflare Pages | `CNAME @ <project>.pages.dev` |
| Render | `CNAME @ <project>.onrender.com` |
| Railway | `CNAME @ <project>.railway.app` |

SSL is provisioned automatically by all of the above.
