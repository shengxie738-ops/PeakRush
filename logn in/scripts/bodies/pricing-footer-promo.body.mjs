() => {
  const doc = document;
  doc.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} });
  const cn = (el) => (el.className && el.className.baseVal !== undefined ? el.className.baseVal : String(el.className || ''));
  const rect = (el) => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 100) / 100); };
  const KEYS = ['display','flexDirection','flexWrap','alignItems','justifyContent','gap','height','lineHeight',
    'fontSize','marginTop','marginBottom','width','maxWidth','whiteSpace','position','rowGap','columnGap'];
  const info = (el) => { const cs = getComputedStyle(el); const o = { cls: cn(el), rect: rect(el), text: el.textContent.trim().slice(0, 200) };
    for (const k of KEYS) o[k] = cs[k]; o.kids = [...el.children].map((c) => ({ cls: cn(c).slice(0, 90), rect: rect(c) })); return o; };
  const frame = doc.querySelector('.plans-difference__frame_upgraded');
  const footer = frame.querySelector('.plans-difference__footer');
  const promo = [...frame.children].find((c) => c.classList.contains('mt-3.25'));
  const swap = frame.querySelector('.text-swap');
  return JSON.stringify({
    footer: info(footer),
    promo: promo ? info(promo) : null,
    swap: swap ? info(swap) : null,
    swapWords: swap ? [...swap.querySelectorAll('.text-swap-item')].map((s) => ({ cls: cn(s), rect: rect(s), text: s.textContent.trim() })) : null,
  });
}
