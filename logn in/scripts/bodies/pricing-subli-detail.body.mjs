() => {
  const doc = document;
  doc.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} });
  const KEYS = ['display','flexDirection','alignItems','justifyContent','height','minHeight','lineHeight',
    'fontSize','paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginBottom',
    'gap','boxSizing','borderTopWidth','borderBottomWidth','position','order','flex','width'];
  const rect = (el) => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 100) / 100); };
  const pick = (el, extra) => {
    const cs = getComputedStyle(el);
    const o = { tag: el.tagName.toLowerCase(), cls: el.className, rect: rect(el) };
    for (const k of KEYS) o[k] = cs[k];
    o.svg = el.querySelectorAll('svg').length;
    o.img = el.querySelectorAll('img').length;
    if (extra) o.text = el.textContent.slice(0, 110);
    return o;
  };
  const li = doc.querySelector('.plans-difference__sub-list li');
  if (!li) return JSON.stringify({ error: 'no sub-list li' });
  return JSON.stringify({
    li: pick(li, true),
    kids: [...li.children].map((c) => ({ ...pick(c, true), grandchildren: [...c.children].map((cc) => pick(cc, true)) })),
  });
}
