// Brain Fry — service worker. Оффлайн-оболочка: кешируем статику приложения.
// Без сетевых запросов к третьим сторонам. Никакой аналитики.

const CACHE = "brainfry-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./css/app.css",
  "./manifest.webmanifest",
  "./js/app.js",
  "./js/config.js",
  "./js/numwords.js",
  "./js/storage.js",
  "./js/tts.js",
  "./js/generator.js",
  "./js/keyboard.js",
  "./js/stats.js",
  "./js/util.js",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  // network-first: онлайн всегда отдаёт свежее, кэш — запасной для офлайна.
  // Так обновления приложения долетают сразу, без застревания на старой версии.
  e.respondWith(
    fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req))
  );
});
