# Selected-products liquid lettering

`selected-liquid.svg` contains the four Chinese glyphs 精、选、好、物 as fixed
vector artwork. The letterforms start from the open-source ZCOOL KuaiLe face;
the contours are rounded and gently reshaped, with connected droplet terminals
and sparse black/white reflections. 精选 is black and 好物 is white with a black
outline. The original 1420 × 465 heading canvas is retained.

Font source: https://github.com/google/fonts/tree/main/ofl/zcoolkuaile
Copyright 2018 The ZCOOL KuaiLe Project Authors.
Font license: SIL Open Font License 1.1; a copy is kept in
`public/fonts/PeakRushLiquid-LICENSE.txt`.

The heading is local SVG artwork. It does not load a font service, use raster
text, or add an animated filter. Its accessible name remains the existing h2.

`new-arrivals-liquid.svg` applies the same treatment to 好物上新, retaining its
original 1420 × 505 canvas. 好物 is black and 上新 is white with a black outline.
The glyph highlights and droplet anchors are adjusted to the new letterforms;
its SVG clip IDs are separate from the selected-products heading.
A thin white rim on 好物 keeps the black strokes clear over the existing product
image, while the original section theme, decoration, and image stay unchanged.
