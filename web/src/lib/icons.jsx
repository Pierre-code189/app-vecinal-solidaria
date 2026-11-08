import React from "react";

/* Un solo sprite de trazos, igual que la versión anterior: nada de emojis. */
const PATHS = {
  home: <><path d="M4 11 12 4l8 7v9H4v-9Z" /><path d="M10 20v-5h4v5" /></>,
  store: <><path d="M4 9.6 5.9 4.5h12.2L20 9.6" /><path d="M4 9.6h16V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.6Z" /><path d="M4 9.6a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" /><path d="M9.6 20v-4.8h4.8V20" /></>,
  solidaridad: <><path d="M12 10.4c-.9-1.6-3.3-1.5-4 .4-.5 1.4.5 2.6 4 4.7 3.5-2.1 4.5-3.3 4-4.7-.7-1.9-3.1-2-4-.4Z" /><path d="M3.8 13.4 7.4 17.6l2.7-2.1" /><path d="M20.2 13.4 16.6 17.6l-2.7-2.1" /></>,
  heart: <path d="M12 20C7 16.5 4 13.6 4 10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 3.5c0 3.1-3 6-8 9.5Z" />,
  alert: <><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 8.5v5" /><path d="M12 16.6v.6" /></>,
  clipboard: <><path d="M9 4h6v3H9V4Z" /><path d="M7 5H5v15h14V5h-2" /><path d="M9 12h6M9 16h4" /></>,
  user: <><path d="M12 11.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
  book: <><path d="M4 5.5C7 4.4 9.8 4.6 12 6.3v13c-2.2-1.7-5-1.9-8-.8v-13Z" /><path d="M20 5.5c-3-1.1-5.8-.9-8 .8v13c2.2-1.7 5-1.9 8-.8v-13Z" /></>,
  shield: <path d="M12 3 5 5.8v6.4c0 4.1 2.9 7.3 7 8.8 4.1-1.5 7-4.7 7-8.8V5.8L12 3Z" />,
  bell: <><path d="M18.5 16.5h-13l1.6-2.3V10a4.9 4.9 0 0 1 9.8 0v4.2l1.6 2.3Z" /><path d="M9.8 19.5a2.4 2.4 0 0 0 4.4 0" /></>,
  pin: <><path d="M12 21s7-6.3 7-11.2A7 7 0 1 0 5 9.8C5 14.7 12 21 12 21Z" /><path d="M12 12.7a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><path d="M11 18.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z" /><path d="M16.6 16.6 21.5 21" /></>,
  copy: <><path d="M9 9.5h10.5V21H9V9.5Z" /><path d="M15.5 9.5V4.5H4.5v11h3" /></>,
  whatsapp: <><path d="M20.5 12a8.5 8.5 0 0 1-12.6 7.4L4 20.5l1.2-4.2A8.5 8.5 0 1 1 20.5 12Z" /><path d="M9 9.4c0 3.4 2.7 6.1 6.1 6.1.7 0 1.4-.7 1.4-1.4l-2-1-1 1c-1.2-.5-2.2-1.5-2.7-2.7l1-1-1-2c-.7 0-1.4.7-1.4 1.4Z" /></>,
  thumb: <><path d="M7.5 20.5V10.5l4-7 1.7 1.3-1.2 4.2h5.2a2 2 0 0 1 2 2.3l-1.1 7a2 2 0 0 1-2 1.7H7.5Z" /><path d="M7.5 20.5h-3V11h3" /></>,
  check: <path d="M4.5 12.5 9.5 17.5 20 6.5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  back: <><path d="M20 12H4.5" /><path d="M10.5 5.5 4 12l6.5 6.5" /></>,
  trash: <><path d="M4.5 7h15" /><path d="M9.5 7V4.5h5V7" /><path d="M6.5 7l1 13.5h9l1-13.5" /><path d="M10 10.5v7M14 10.5v7" /></>,
  camera: <><path d="M3.5 8.5h3.4l1.6-2.5h7l1.6 2.5h3.4V20H3.5V8.5Z" /><path d="M12 17.5a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2Z" /></>,
  lock: <><path d="M7.5 11V8a4.5 4.5 0 0 1 9 0v3" /><path d="M5 11h14v10H5V11Z" /></>,
  wallet: <><path d="M3.5 7.5 5.5 4.5h13l2 3" /><path d="M3.5 7.5h17V19h-17V7.5Z" /><path d="M15.5 13.3h3" /></>,
  speaker: <><path d="M11 5 6.5 9H3.5v6h3L11 19V5Z" /><path d="M15.5 7.5a6 6 0 0 1 0 9" /><path d="M18 4.8a9.5 9.5 0 0 1 0 14.4" /></>,
  clock: <><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" /><path d="M12 7.5V12l3 2" /></>,
  tool: <path d="M14.5 6.5a4 4 0 1 0 4 4l-9.5 9.5-2-2L16.5 8.5a4 4 0 0 1-2-2Z" />,
  hammer: <><path d="M14 4.5 19.5 10l-2.7 2.7-5.5-5.5L14 4.5Z" /><path d="M11.6 8.4 4 16l3.5 3.5 7.6-7.6" /></>,
  bolt: <path d="M13.5 3 5.5 14H10l-1 7 8-11h-4.5l1-7Z" />,
  key: <path d="M14.5 10.5a4 4 0 1 0-3.7 4L9 16.3v2.2H6.8v2.2H4v-3.7l7.8-7.8a4 4 0 0 1 2.7-1.2Z" />,
  food: <><path d="M4 11.5h16a8 8 0 0 1-16 0Z" /><path d="M6.5 17h11" /></>,
  paw: <><path d="M8 10a1.8 1.8 0 1 0 0-3.6A1.8 1.8 0 0 0 8 10Z" /><path d="M16 10a1.8 1.8 0 1 0 0-3.6A1.8 1.8 0 0 0 16 10Z" /><path d="M5.5 14.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z" /><path d="M18.5 14.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z" /><path d="M12 21c2.6 0 4.5-1.5 4.5-3.4 0-2-2-3.1-4.5-3.1s-4.5 1.1-4.5 3.1C7.5 19.5 9.4 21 12 21Z" /></>,
  car: <><path d="M4.5 16.5h15v-4.2L17.2 7H6.8L4.5 12.3v4.2Z" /><path d="M6.5 16.5v2M17.5 16.5v2" /><path d="M7.5 12.5h9" /></>,
  box: <><path d="M4 8.2 12 4.5l8 3.7-8 3.7-8-3.7Z" /><path d="M4 8.2v7.6l8 3.7 8-3.7V8.2" /></>,
  dots: <path d="M6 12h.01M12 12h.01M18 12h.01" strokeWidth="2.6" />,
  chat: <><path d="M4 5h16v11H9l-5 4V5Z" /><path d="M8 10h8M8 13h5" /></>,
  flag: <><path d="M6 21V4" /><path d="M6 5h12l-2 4 2 4H6" /></>,
  handshake: <path d="M3 11l4-4 3 3 2-2 2 2 3-3 4 4-4 3-3-2-2 2-3-2-6 3Z" />,
  star: <path d="m12 4 2.4 5 5.6.8-4 4 1 5.6-5-2.7-5 2.7 1-5.6-4-4 5.6-.8L12 4Z" />,
  phone: <path d="M6 3h3l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2Z" />,
  mic: <><rect x="9" y="3" width="6" height="10" rx="3" /><path d="M6 11.5a6 6 0 0 0 12 0" /><path d="M12 17.5V21M9 21h6" /></>,
  text: <><path d="M5 7V5h14v2M12 5v14M9 19h6" /></>,
  eye: <><path d="M2.5 12S6.2 6.3 12 6.3 21.5 12 21.5 12 17.8 17.7 12 17.7 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeoff: <><path d="M4 4l16 16" /><path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c5.8 0 9.5 7 9.5 7a17 17 0 0 1-2.8 3.6" /><path d="M6.4 7.4A17 17 0 0 0 2.5 12s3.7 7 9.5 7a9.4 9.4 0 0 0 3.7-.8" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  refresh: <><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v4h-4" /></>,
  logout: <><path d="M15 4h4v16h-4" /><path d="M11 8 7 12l4 4M7 12h9" /></>,
};

export function Icon({ name, size = "1em", className = "", strokeWidth = 1.7 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`ic ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name] || PATHS.dots}
    </svg>
  );
}

export const CAT_ICON = {
  "gasfitería": "tool", "carpintería": "hammer", "electricidad": "bolt",
  "cerrajería": "key", "clases": "book", "alimentos": "food",
  "paseo de mascotas": "paw", "herramientas": "tool", "movilidad": "car",
  "préstamo": "box", "otros": "dots",
};
