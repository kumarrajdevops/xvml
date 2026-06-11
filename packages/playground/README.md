# XVML Playground

Web-based editor with live preview for `.xvml` files.

## Run locally

```bash
cd packages/playground
npm install
npm run dev
```

Opens at `http://localhost:5173`

## Deploy to Vercel

1. Install Vercel CLI (once):
   ```bash
   npm install -g vercel
   ```

2. Deploy from the playground directory:
   ```bash
   cd packages/playground
   vercel
   ```

3. Follow the prompts — select your Vercel account and project name.

4. For production deploy:
   ```bash
   vercel --prod
   ```

## Custom domain (xvml-lang.dev)

After deploying to Vercel:

1. Go to **Vercel dashboard → Project → Settings → Domains**
2. Add `xvml-lang.dev`
3. At your DNS registrar, add:
   - `A` record: `@` → `76.76.21.21`
   - `CNAME` record: `www` → `cname.vercel-dns.com`
4. Vercel auto-provisions an SSL certificate within minutes

## Build for static hosting (GitHub Pages etc.)

```bash
cd packages/playground
npm run build
# Output is in packages/playground/dist/
```
