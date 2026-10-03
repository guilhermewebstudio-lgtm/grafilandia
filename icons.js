// Ícones SVG inline (traço), usados nas vistas EJS com <%- icon('nome') %>.
const P = {
  card: '<rect x="3" y="6" width="18" height="12" rx="1.5"/><path d="M7 10h6M7 14h4"/>',
  flyer: '<path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  poster: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h6M8 17l3-4 2 2 3-4"/>',
  shirt: '<path d="M8 3L3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z"/>',
  gift: '<rect x="3" y="8" width="18" height="4"/><path d="M12 8v13M5 12v9h14v-9M12 8C10 4 6 5 7 8c.5 1.500 3 1 5 0zM12 8c2-4 6-3 5 0-.5 1.500-3 1-5 0z"/>',
  sticker: '<path d="M4 4h16v10l-6 6H4z"/><path d="M14 20v-6h6"/>',
  printer: '<path d="M7 9V3h10v6M7 17H4v-6h16v6h-3M7 14h10v7H7z"/>',
  phone: '<path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="1.500"/><path d="M3 7l9 6 9-6"/>',
  pin: '<path d="M12 21s7-6.200 7-11a7 7 0 0 0-14 0c0 4.800 7 11 7 11z"/><circle cx="12" cy="10" r="2.500"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  whatsapp: '<path d="M3 21l1.600-5A8.500 8.500 0 1 1 8 19.400z"/><path d="M9 9c0 3 3 6 6 6l1.200-1.600-2.200-1.200-1 .8c-1-.4-2-1.400-2.400-2.400l.8-1L10.200 7z"/>',
  facebook: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="M5 12.500l4.500 4.500L19 7"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  send: '<path d="M3 11l18-8-8 18-2-8z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20l4-1 11-11-3-3L5 16z"/>',
  star: '<path d="M12 3l2.800 5.700 6.200.9-4.500 4.400 1 6.200L12 17.200 6.500 20.200l1-6.200L3 9.600l6.200-.9z"/>',
};

function icon(name, cls = '') {
  const d = P[name] || P.flyer;
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
}

const ICON_NAMES = ['card', 'flyer', 'poster', 'shirt', 'gift', 'sticker', 'printer'];

module.exports = { icon, ICON_NAMES };
