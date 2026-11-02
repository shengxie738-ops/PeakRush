# UI assets
The user selected the second orange storefront mock. Four project assets were generated from that reference with the built-in image tool on 2026-09-28.
frontend/public/assets/hero-earbuds.png, product-earbuds.png, product-camera.png, product-watch.png are local generated product photographs. They are not actual product endorsements.
Design reference: ../artifacts/ui/selected-reference.png

## Catalog expansion 2026-10-09

Six distinct professional product advertising photographs were generated with the built-in `image_gen` tool. They use warm peach and terracotta lighting to fit the existing storefront. Each image has a different subject and was generated with its own prompt, without logos, prices or promotional text baked into the bitmap.

| Product | Saved project asset |
| --- | --- |
| Espresso machine | `frontend/public/assets/products/coffee-machine.png` |
| Portable speaker | `frontend/public/assets/products/portable-speaker.png` |
| Mechanical keyboard | `frontend/public/assets/products/mechanical-keyboard.png` |
| Table lamp | `frontend/public/assets/products/desk-lamp.png` |
| Trail running shoes | `frontend/public/assets/products/trail-shoes.png` |
| Carry-on suitcase | `frontend/public/assets/products/carry-on.png` |

The final prompt set and generation identifiers are retained in [generation.json](../frontend/public/assets/products/generation.json). All six PNGs are 1536 × 1024. Their subjects and crops were inspected, and all nine old/new catalog image URLs returned actual image content through the local frontend. The product records and current/future V3 activities use these local paths. These remain generated demonstration product visuals; descriptions and prices belong to the demo catalog.

