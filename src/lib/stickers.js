// Map stickers: one small drawing per layer, filled with the layer's colour.
// Paths are drawn on a 24×24 grid.

const SHAPES = {
  frame: '<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M7 16l3.5-4 2.5 3 2-2 2 3" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>',
  arch: '<path d="M4 20V11a8 8 0 0 1 16 0v9h-4v-9a4 4 0 0 0-8 0v9z"/>',
  star: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19l8-8" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>',
  dot: '<circle cx="12" cy="12" r="7"/>',
};

export function stickerSvg(icon, color, { size = 30, favourite = false } = {}) {
  const shape = SHAPES[icon] || SHAPES.dot;
  // White "die-cut" outline around the drawing, like a real sticker.
  return `<svg class="sticker${favourite ? ' sticker--fav' : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
    <g fill="#fff" stroke="#fff" stroke-width="4.5" stroke-linejoin="round">${shape}</g>
    <g fill="${color}">${shape}</g>
  </svg>`;
}
