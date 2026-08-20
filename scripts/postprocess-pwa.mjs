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
  icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
};
const serviceWorker = `const CACHE = "lico-shell-v1";
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(["/", "/index.html"]))));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match("/index.html"))));
});`;

const indexPath = join(dist, "index.html");
const index = await readFile(indexPath, "utf8");
const tags = `  <link rel="manifest" href="/manifest.webmanifest" />\n  <link rel="apple-touch-icon" href="/icon.png" />\n  <script>if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");</script>`;
await writeFile(indexPath, index.replace("</head>", `${tags}\n</head>`));
await writeFile(join(dist, "manifest.webmanifest"), JSON.stringify(manifest));
await writeFile(join(dist, "sw.js"), serviceWorker);
await copyFile("assets/icon.png", join(dist, "icon.png"));
