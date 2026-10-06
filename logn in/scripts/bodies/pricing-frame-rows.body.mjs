() => {
  const doc = document;
  doc.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} });
  const rect = (el) => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 100) / 100); };
  const cn = (el) => (el.className && el.className.baseVal !== undefined ? el.className.baseVal : String(el.className || ''));
  const frames = [];
  for (const frame of doc.querySelectorAll('.plans-difference__frame')) {
    const liRows = [];
    for (const li of frame.querySelectorAll('.plans-difference__list > li')) {
      const subs = [...li.querySelectorAll(':scope > ul')];
      liRows.push({
        cls: cn(li), rect: rect(li),
        title: (li.querySelector('.plans-difference__list-title') || {}).textContent,
        subLists: subs.map((ul) => ({ cls: cn(ul), rect: rect(ul),
          items: [...ul.children].map((it) => {
            const icon = it.querySelector('.plans-difference__subscription-status-icon');
            const use = icon ? icon.querySelector('use') : null;
            return { cls: cn(it), rect: rect(it), disp: getComputedStyle(it).display,
              title: (it.querySelector('.plans-difference__list-item-title p') || {}).textContent,
              iconCls: icon ? cn(icon) : null, iconHref: use ? (use.getAttribute('href') || use.getAttribute('xlink:href')) : null,
              text: it.textContent.trim().slice(0, 100) };
          }) })),
      });
    }
    frames.push({ cls: cn(frame), rect: rect(frame), rows: liRows });
  }
  const rules = [];
  // No regex literals in this body: it is also pasted into the browser probe, whose transport
  // re-parses backslash escapes and silently rewrites them (a dot-class matcher lost its dot, and a
  // word-boundary escape became a literal backspace). Substring tests instead.
  const NEEDLES = ['.icon', 'subscription-status-icon', 'plans-difference__sub-list', 'plans-difference--md', 'plans-difference--sm', 'plans-difference__list-item'];
  for (const sheet of doc.styleSheets) {
    let rs; try { rs = sheet.cssRules; } catch (e) { continue; }
    for (const r of rs) {
      if (r.type === 1 && r.selectorText && NEEDLES.some((n) => r.selectorText.indexOf(n) >= 0)) {
        rules.push({ sel: r.selectorText, decl: [...r.style].map((p) => p + ':' + r.style.getPropertyValue(p)).join(';').slice(0, 260) });
      }
    }
  }
  return JSON.stringify({ frames, rules });
}
