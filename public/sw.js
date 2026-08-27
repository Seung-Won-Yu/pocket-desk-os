const CACHE_PREFIX = "pocketdesk-os-";
/*
 * The build stamps a fresh value in here. A hand-maintained version number meant
 * a poisoned cache entry survived every deploy that forgot to bump it: activate
 * only evicts caches whose *name* differs, so a script that wrote a malicious
 * response into this cache kept being served, offline and forever, long after
 * whatever let it in was fixed.
 */
const CACHE_NAME = "pocketdesk-os-__BUILD_ID__";
const SCOPE_URL = new URL(self.registration.scope);
const INDEX_URL = new URL("./index.html", SCOPE_URL).href;
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

function getBundledAssetUrls(html) {
  const assetUrls = new Set();
  const attributePattern = /(?:href|src)=["']([^"']+)["']/g;

  for (const match of html.matchAll(attributePattern)) {
    const url = new URL(match[1], INDEX_URL);
    if (url.origin === self.location.origin && url.pathname.includes("/assets/")) {
      assetUrls.add(url.href);
    }
  }

  return [...assetUrls];
}

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(APP_SHELL);

  const indexResponse = await fetch(INDEX_URL, { cache: "no-store" });
  if (!indexResponse.ok) throw new Error(`App shell returned ${indexResponse.status}`);

  await cache.put(INDEX_URL, indexResponse.clone());
  const assetUrls = getBundledAssetUrls(await indexResponse.text());
  await cache.addAll(assetUrls);
}

async function putSuccessfulResponse(cache, request, response) {
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(request, { signal: controller.signal });
    await putSuccessfulResponse(cache, request, response);
    return response;
  } catch {
    return (
      (await cache.match(request, { ignoreSearch: true, ignoreVary: true })) ||
      (await cache.match(INDEX_URL)) ||
      Response.error()
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/*
 * ignoreSearch is gone: it let one cached entry answer for every query-string
 * variant of a URL, and a hashed asset filename never needs that. ignoreVary
 * stays, because the response may carry a Vary header the offline match would
 * otherwise fail on.
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;

  const response = await fetch(request);
  return putSuccessfulResponse(cache, request, response);
}

function staleWhileRevalidate(event) {
  const cachePromise = caches.open(CACHE_NAME);
  const networkResponse = cachePromise.then((cache) =>
    fetch(event.request).then((response) => putSuccessfulResponse(cache, event.request, response)),
  );
  event.waitUntil(networkResponse.catch(() => undefined));

  return cachePromise
    .then((cache) => cache.match(event.request, { ignoreSearch: true, ignoreVary: true }))
    .then((cached) => cached || networkResponse);
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim())
      .then(async () => {
        const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
        clients.forEach((client) => client.postMessage({ type: "POCKETDESK_SW_ACTIVATED" }));
      }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.includes("/assets/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(event));
});
