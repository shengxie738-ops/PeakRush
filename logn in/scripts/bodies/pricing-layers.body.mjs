() => {
  const doc = document;
  doc.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} });
  const h = (el) => Math.round(el.getBoundingClientRect().height * 100) / 100;
  const layers = [...doc.querySelectorAll('.section__layer')].map((el) => {
    const inner = el.firstElementChild;
    const ics = inner ? getComputedStyle(inner) : null;
    return {
      cls: String(el.className).slice(0, 110),
      rect: (() => { const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width * 100) / 100, h(el)]; })(),
      innerCls: inner ? String(inner.className).slice(0, 110) : null,
      innerPt: ics ? ics.paddingTop : null,
      innerPb: ics ? ics.paddingBottom : null,
      innerPos: ics ? ics.position : null,
    };
  });
  const scroller = doc.querySelector('.scrollable__area');
  return JSON.stringify({
    layers,
    scrollHeights: {
      documentElement: doc.documentElement.scrollHeight,
      body: doc.body.scrollHeight,
      scrollableArea: scroller ? scroller.scrollHeight : null,
    },
    // The sticky layers live inside a scroll container on this site; which element scrolls changes
    // what "page height 4282" even means, so record every candidate rather than assume.
    scrollerCls: scroller ? String(scroller.className).slice(0, 80) : null,
    scrollerH: scroller ? h(scroller) : null,
  });
}
