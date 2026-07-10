# TODO - Fix /blog 404 on Vercel

- [x] Update `vercel.json` so `/blog` and `/blog/*` route to `backend/server.js` before filesystem handling.

- [ ] Ensure `/api/*` routing remains unchanged.
- [x] Verify locally: confirm HTTP 200 for `/blog`, `/blog/index.html`, and at least one `/blog/<slug>.html`.

- [ ] Deploy to Vercel and verify HTTP 200 for `/blog`, `/blog/index.html`, and all blog HTML files.
- [ ] Confirm API endpoints are not broken.

