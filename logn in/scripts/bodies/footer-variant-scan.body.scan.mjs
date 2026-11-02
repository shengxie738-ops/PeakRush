async () => {
  // Reference-side route sweep: which footer variant does each route carry?
  // Runs inside the probe iframe's own realm and walks the SPA router, so it is reference-only
  // plumbing (the clone is swept route-by-route by tests instead) — hence the .scan. name.
  const doc = document;
  const app = doc.querySelector('#__nuxt');
  const router = app && app.__vue_app__ && app.__vue_app__.config.globalProperties.$router;
  if (!router) return JSON.stringify({ error: 'no router in this realm' });
  const ROUTES = ['/pricing', '/gift-card', '/about', '/our-product', '/faq', '/terms-and-conditions', '/signin'];
  const out = [];
  for (const r of ROUTES) {
    try { await router.push(r); } catch (e) { out.push({ route: r, error: String(e).slice(0, 60) }); continue; }
    await new Promise((res) => setTimeout(res, 400));
    try { doc.getAnimations().forEach((a) => { try { a.finish(); } catch (e2) {} }); } catch (e) {}
    const sc = doc.querySelector('.scrollable__area');
    const sy = sc ? sc.scrollTop : 0;
    out.push({
      route: r,
      scrollHeight: sc ? sc.scrollHeight : doc.documentElement.scrollHeight,
      footers: [...doc.querySelectorAll('footer')].map((f) => {
        const b = f.getBoundingClientRect();
        return String(f.getAttribute('class') || '').slice(0, 60) + ' |pos=' + doc.defaultView.getComputedStyle(f).position +
          ' |h=' + (Math.round(b.height * 100) / 100) + ' |top=' + (Math.round((b.top + sy) * 100) / 100);
      }),
    });
  }
  return JSON.stringify({ swept: out.length, routes: out });
}
