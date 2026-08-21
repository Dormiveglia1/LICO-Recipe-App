import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dist = "dist";
const manifest = {
  name: "栗刻 LICO",
  short_name: "栗刻",
  start_url: "/",
  display: "standalone",
  background_color: "#FFF9F0",
  theme_color: "#FFF9F0",
  icons: [{ src: "/chestnut-app-icon.png", sizes: "1024x1024", type: "image/png" }],
};
const cacheId = `lico-shell-${Date.now()}`;
const serviceWorker = `const CACHE = "${cacheId}";
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(["/", "/index.html"])).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put("/index.html", response.clone()));
      return response;
    }).catch(() => caches.match("/index.html")));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match("/index.html"))));
});`;

const indexPath = join(dist, "index.html");
const index = await readFile(indexPath, "utf8");
const tags = `  <link rel="manifest" href="/manifest.webmanifest" />\n  <link rel="apple-touch-icon" href="/chestnut-app-icon.png" />\n  <style id="lico-viewport-lock">\n    /* Safari otherwise scrolls the entire document to a focused input. */\n    html, body { position: fixed; inset: 0; width: 100%; height: 100%; overflow: hidden; }\n    #root { width: 100%; min-height: 100%; overflow: hidden; }\n  </style>\n  <script>\n    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");\n    const preventZoom = event => event.preventDefault();\n    document.addEventListener("gesturestart", preventZoom, { passive: false });\n    document.addEventListener("gesturechange", preventZoom, { passive: false });\n    document.addEventListener("gestureend", preventZoom, { passive: false });\n    document.addEventListener("touchmove", event => { if (event.touches.length > 1) event.preventDefault(); }, { passive: false });\n  </script>`;
const mobileViewport = '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />';
await writeFile(
  indexPath,
  index
    .replace(/<meta name="viewport"[^>]*\/>/, mobileViewport)
    .replace("</head>", `${tags}\n</head>`),
);
await writeFile(join(dist, "manifest.webmanifest"), JSON.stringify(manifest));
await writeFile(join(dist, "sw.js"), serviceWorker);
await copyFile("assets/chestnut-app-icon.png", join(dist, "chestnut-app-icon.png"));
