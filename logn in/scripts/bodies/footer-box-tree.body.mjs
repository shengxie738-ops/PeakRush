() => {
  // Zero-arg, backslash-free, no regex escapes: this exact text runs on BOTH sides
  // (reference via a hidden same-origin iframe, clone via run-page-body.mjs).
  const doc = document;
  try { doc.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} }); } catch (e) {}
  const sc = doc.querySelector('.scrollable__area');
  const sy = sc ? sc.scrollTop : doc.documentElement.scrollTop;
  const sx = sc ? sc.scrollLeft : doc.documentElement.scrollLeft;
  const footer = doc.querySelector('footer');
  if (!footer) {
    return JSON.stringify({ none: true, scrollHeight: sc ? sc.scrollHeight : doc.documentElement.scrollHeight,
      tail: sc ? [...sc.children].slice(-4).map((c) => String(c.className).slice(0, 60) + '|h=' + Math.round(c.getBoundingClientRect().height * 100) / 100) : [] });
  }
  const PROPS = ['display', 'position', 'flexDirection', 'alignItems', 'justifyContent', 'gap',
    'height', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
    'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textTransform', 'textAlign',
    'color', 'backgroundColor', 'borderTopWidth', 'borderTopStyle', 'borderTopColor',
    'opacity', 'whiteSpace', 'maxWidth', 'textDecorationLine', 'borderRadius', 'boxSizing'];
  const clsOf = (el) => {
    const c = el.getAttribute('class');
    return c === null ? '' : String(c);
  };
  const abs = (el) => {
    const r = el.getBoundingClientRect();
    return [Math.round((r.left + sx) * 100) / 100, Math.round((r.top + sy) * 100) / 100,
      Math.round(r.width * 100) / 100, Math.round(r.height * 100) / 100];
  };
  const styles = (el) => {
    const cs = doc.defaultView.getComputedStyle(el);
    const o = {};
    for (const p of PROPS) {
      const v = cs[p];
      if (v === 'normal' || v === 'auto' || v === 'none' || v === '0px' || v === 'row' || v === 'stretch' || v === 'static') continue;
      o[p] = v;
    }
    return o;
  };
  const leafText = (el) => (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 ? el.textContent.trim() : '');
  const nodes = [];
  (function walk(el, depth) {
    if (depth > 5) return;
    for (const c of el.children) {
      const rec = { depth, tag: c.tagName.toLowerCase(), cls: clsOf(c).slice(0, 130), box: abs(c), s: styles(c) };
      const t = leafText(c);
      if (t) rec.text = t.slice(0, 80);
      if (rec.tag === 'a') rec.href = c.getAttribute('href');
      if (rec.tag === 'img') rec.src = c.getAttribute('src');
      nodes.push(rec);
      walk(c, depth + 1);
    }
  })(footer, 0);
  const fr = footer.getBoundingClientRect();
  return JSON.stringify({
    tag: 'footer', cls: clsOf(footer), box: abs(footer), s: styles(footer),
    fullText: footer.textContent.trim().slice(0, 400),
    linkCount: footer.querySelectorAll('a').length,
    imgCount: footer.querySelectorAll('img').length,
    scrollHeight: sc ? sc.scrollHeight : doc.documentElement.scrollHeight,
    selfBox: [Math.round(fr.left * 100) / 100, Math.round(fr.top * 100) / 100, Math.round(fr.width * 100) / 100, Math.round(fr.height * 100) / 100],
    nodes,
  });
}
