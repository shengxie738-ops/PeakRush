() => {
  const doc = document;
  // Entrance animations freeze at their start value on a surface that never paints; finishing them
  // measures the state a user actually sees.
  doc.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} });
  const h = (el) => Math.round(el.getBoundingClientRect().height * 100) / 100;
  // textContent/className are recorded raw. Whitespace collapsing happens in Node, not here: this
  // body travels through a template literal into the browser probe, and a regex escape sequence
  // re-parsed en route silently rewrote every text field (it turned "Presentation" into
  // "Pre entation"). Keep the page side free of backslashes.
  const out = [];
  for (const ul of doc.querySelectorAll('.plans-difference__list')) {
    const frame = ul.closest('.plans-difference__frame');
    const rec = {
      frame: frame ? frame.className.slice(0, 80) : null,
      ulCls: ul.className, ulH: h(ul), gap: getComputedStyle(ul).gap, items: [],
    };
    for (const li of ul.children) {
      const cs = getComputedStyle(li);
      const sub = li.querySelector('ul');
      rec.items.push({
        cls: li.className.slice(0, 90), h: h(li), mt: cs.marginTop, mb: cs.marginBottom,
        disp: cs.display, fs: cs.fontSize, lh: cs.lineHeight,
        text: li.textContent.slice(0, 120),
        subCls: sub ? sub.className.slice(0, 60) : null,
        subCount: sub ? sub.children.length : 0,
        subH: sub ? h(sub) : null,
        subGap: sub ? getComputedStyle(sub).gap : null,
        subItems: sub ? [...sub.children].map((s) => ({
          h: h(s), cls: s.className.slice(0, 60), text: s.textContent.slice(0, 90),
        })) : null,
      });
    }
    out.push(rec);
  }
  return JSON.stringify(out);
}
