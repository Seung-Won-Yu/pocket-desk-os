const CACHE_NAME = "pocketdesk-os-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./robots.txt",
  "./llms.txt",
  "./brand/pocketdesk-mark.svg",
  "./brand/pocketdesk-icon-192.png",
  "./brand/pocketdesk-icon-512.png",
  "./brand/pocketdesk-social.png",
  "./wallpapers/aurora-lake.jpg",
  "./wallpapers/blue-ribbon.jpg",
  "./wallpapers/dawn-lake.jpg",
  "./wallpapers/glass-wave.jpg",
  "./wallpapers/green-vista.jpg",
  "./wallpapers/misty-peak.jpg",
  "./wallpapers/moon-coast.jpg",
  "./wallpapers/sunny-field.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./", copy));
          return response;
        })
        .catch(() => caches.match("./")),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
