const CACHE = "ikot-final-v7";
const ASSETS = [
  "./manifest.webmanifest",
  "./icon.svg"
];

const SHARED_IMAGE_URL = "./__ikot_shared_image";
const SHARED_DATA_URL = "./__ikot_shared_data";

self.addEventListener("install", event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter(k => k !== CACHE)
        .map(k => caches.delete(k))
    );

    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // Androidの共有 → IKOT
  if (
    request.method === "POST" &&
    url.pathname.endsWith("/share")
  ) {
    event.respondWith((async () => {
      try {
        const form = await request.formData();

        const title = form.get("title") || "";
        const text = form.get("text") || "";
        const sharedUrl = form.get("url") || "";
        const file = form.get("files");

        const cache = await caches.open(CACHE);

        // 共有された文字情報を保存
        await cache.put(
          new Request(new URL(SHARED_DATA_URL, self.location.origin)),
          new Response(
            JSON.stringify({
              title: String(title),
              text: String(text),
              url: String(sharedUrl)
            }),
            {
              headers: {
                "Content-Type": "application/json"
              }
            }
          )
        );

        // 共有画像を保存
        if (file instanceof File && file.size > 0) {
          await cache.put(
            new Request(
              new URL(SHARED_IMAGE_URL, self.location.origin)
            ),
            new Response(file, {
              headers: {
                "Content-Type":
                  file.type || "image/jpeg"
              }
            })
          );
        }

        return Response.redirect(
          new URL("./?share_image=1", self.location.origin),
          303
        );
      } catch (err) {
        console.error("Share receive error:", err);

        return Response.redirect(
          new URL("./?share_error=1", self.location.origin),
          303
        );
      }
    })());

    return;
  }

  if (request.method !== "GET") return;

  event.respondWith((async () => {
    try {
      const fresh = await fetch(request);

      if (fresh && fresh.ok) {
        const cache = await caches.open(CACHE);
        cache.put(request, fresh.clone());
      }

      return fresh;
    } catch (err) {
      const cached = await caches.match(request);

      if (cached) return cached;

      if (request.mode === "navigate") {
        const home = await caches.match("./");
        if (home) return home;
      }

      throw err;
    }
  })());
});
