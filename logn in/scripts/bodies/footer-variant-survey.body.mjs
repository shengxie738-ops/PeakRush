() => {
  // Which footer variant does this route carry, and how tall is it? Same body on both sides.
  const doc = document;
  try { doc.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} }); } catch (e) {}
  const sc = doc.querySelector('.scrollable__area');
  const sy = sc ? sc.scrollTop : 0;
  const out = { path: doc.location.pathname, scrollHeight: sc ? sc.scrollHeight : doc.documentElement.scrollHeight };
  const footers = [...doc.querySelectorAll('footer')].map((f) => {
    const r = f.getBoundingClientRect();
    const cs = doc.defaultView.getComputedStyle(f);
    return {
      cls: String(f.getAttribute('class') || ''),
      pos: cs.position,
      h: Math.round(r.height * 100) / 100,
      top: Math.round((r.top + sy) * 100) / 100,
      kids: [...f.children].map((c) => c.tagName.toLowerCase() + '.' + String(c.getAttribute('class') || '').slice(0, 40) + '|h=' + Math.round(c.getBoundingClientRect().height * 100) / 100),
    };
  });
  out.footers = footers;
  // The sticky-layer model tells us whether the footer is a layer of its own (home) or flow content.
  out.layers = sc ? [...sc.children].map((c) => String(c.className).slice(0, 46) + '|h=' + Math.round(c.getBoundingClientRect().height * 100) / 100) : [];
  return JSON.stringify(out);
}
