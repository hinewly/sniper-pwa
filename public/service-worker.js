/* 屋顶狙击 SW v12 */
const CACHE = "dbsniper-v17";
const ASSETS = [
  "./", "./index.html", "./style.css?v=6", "./game.js?v=16", "assets/mg-icon.png",
  "./manifest.json", "./icons/favicon.svg",
  "./assets/sniper.png", "./assets/mg.png", "./assets/bandit-red.png",
  "./assets/bandit-blue.png", "./assets/wolf.png", "./assets/boss.png",
  "./icons/icon-48.png", "./icons/icon-64.png", "./icons/icon-192.png", "./icons/icon-512.png"
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit || fetch(e.request).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      }).catch(() => hit)
    )
  );
});
