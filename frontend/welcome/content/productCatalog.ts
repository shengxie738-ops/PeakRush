/** Distinct advertising artwork shared by the welcome page's product displays. */
export const PRODUCT_CATALOG = [
  { key: 'phone', name: '旗舰智能手机', role: '让灵感随手发生', photo: '/peakrush/ads/phone.webp' },
  { key: 'laptop', name: '轻薄笔记本', role: '随时开启创造力', photo: '/peakrush/ads/laptop.webp' },
  { key: 'sneakers', name: '轻量运动鞋', role: '迈出轻快的一步', photo: '/peakrush/ads/sneakers.webp' },
  { key: 'jacket', name: '机能外套', role: '自在穿行每一天', photo: '/peakrush/ads/jacket.webp' },
  { key: 'drone', name: '轻型航拍无人机', role: '换个视角看世界', photo: '/peakrush/ads/drone.webp' },
  { key: 'tablet', name: '创作平板', role: '把想象画成现实', photo: '/peakrush/ads/tablet.webp' },
  { key: 'console', name: '掌上游戏机', role: '随时进入游戏世界', photo: '/peakrush/ads/console.webp' },
  { key: 'earbuds', name: '无线耳机', role: '听见每一份热爱', photo: '/peakrush/ads/earbuds.webp' },
  { key: 'watch', name: '智能手表', role: '腕间记录每一刻', photo: '/peakrush/ads/watch.webp' },
  { key: 'camera', name: '便携相机', role: '定格城市的故事', photo: '/peakrush/ads/camera.webp' },
] as const;

/** Existing image callers use one-based indices; wrap only after the full catalog. */
export const productPhoto = (n: number): string => PRODUCT_CATALOG[(n - 1) % PRODUCT_CATALOG.length]!.photo;
export const productCard = productPhoto;
