() => {
  const doc = document;
  const sc = doc.querySelector('.scrollable__area');
  const f = doc.querySelector('footer');
  if (!f) {
    return JSON.stringify({
      none: true,
      tail: [...sc.children].slice(-4).map((c) => String(c.className).slice(0, 60) + '|h=' + Math.round(c.getBoundingClientRect().height)),
    });
  }
  const r = f.getBoundingClientRect();
  const cs = getComputedStyle(f);
  const kids = [...f.children].map((c) => {
    const cr = c.getBoundingClientRect();
    return (
      c.tagName.toLowerCase() +
      '.' + String(c.className).slice(0, 44) +
      ' h=' + Math.round(cr.height * 100) / 100 +
      ' y=' + Math.round((cr.top + sc.scrollTop) * 100) / 100
    );
  });
  return JSON.stringify({
    cls: String(f.className).slice(0, 140),
    h: Math.round(r.height * 100) / 100,
    top: Math.round((r.top + sc.scrollTop) * 100) / 100,
    pos: cs.position,
    disp: cs.display,
    kidCount: f.children.length,
    kids,
  });
}
