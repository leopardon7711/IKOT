const CACHE="ikot-final-v6";
const ASSETS=["./manifest.webmanifest","./icon.svg"];

self.addEventListener("install",event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;
  const request=event.request;
  event.respondWith((async()=>{
    try{
      const fresh=await fetch(request);
      if(fresh && fresh.ok){
        const cache=await caches.open(CACHE);
        cache.put(request,fresh.clone());
      }
      return fresh;
    }catch(err){
      const cached=await caches.match(request);
      if(cached) return cached;
      if(request.mode==="navigate"){
        const home=await caches.match("./");
        if(home) return home;
      }
      throw err;
    }
  })());
});
