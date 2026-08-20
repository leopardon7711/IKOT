const CACHE = "ikot-final-v9";

const ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png"
];

const SHARED_IMAGE_URL = "/__ikot_shared_image";
const SHARED_DATA_URL = "/__ikot_shared_data";

/* =========================
   インストール
========================= */

self.addEventListener("install", event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

/* =========================
   有効化・古いキャッシュ削除
========================= */

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

/* =========================
   通信
========================= */

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  /* -------------------------
     Android共有 → IKOT
  ------------------------- */

  if (
    request.method === "POST" &&
    url.pathname.endsWith("/share")
  ) {
    event.respondWith(
      (async () => {
        try {
          const form = await request.formData();

          const title = form.get("title") || "";
          const text = form.get("text") || "";
          const sharedUrl = form.get("url") || "";
          const file = form.get("files");

          const cache = await caches.open(CACHE);

          // 共有された文字情報を保存
          await cache.put(
            SHARED_DATA_URL,
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

          // 共有された画像を保存
          if (file instanceof File && file.size > 0) {
            await cache.put(
              SHARED_IMAGE_URL,
              new Response(file, {
                headers: {
                  "Content-Type":
                    file.type || "image/jpeg"
                }
              })
            );
          } else {
            // 前回共有した画像が残らないよう削除
            await cache.delete(SHARED_IMAGE_URL);
          }

          return Response.redirect(
            new URL("/?share_image=1", self.location.origin),
            303
          );

        } catch (err) {
          console.error("Share receive error:", err);

          return Response.redirect(
            new URL("/?share_error=1", self.location.origin),
            303
          );
        }
      })()
    );

    return;
  }

  /* -------------------------
     一時保存した共有データを返す
  ------------------------- */

  if (
    request.method === "GET" &&
    (
      url.pathname.ends
