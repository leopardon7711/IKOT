const CACHE='ikot-final-v4';

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','./index.html','./manifest.webmanifest','./icon.svg'])));
});

self.self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);

  // Instagram / X / TikTok / YouTubeなどのOS共有からIKOTへ送られたデータを受け取る
  if(e.request.method==='POST' && u.pathname.endsWith('/share')){
    e.respondWith((async()=>{
      try{
        const form=await e.request.formData();
        const params=new URLSearchParams();
        for(const key of ['title','text','url']){
          const value=form.get(key);
          if(typeof value==='string' && value) params.set(key,value);
        }
        // 画像・動画ファイルは現バージョンでは保存せず、URL/文字情報だけIKOTへ渡す
        return Response.redirect(new URL('./?'+params.toString(),u.origin).toString(),303);
      }catch(err){
        return Response.redirect(new URL('./',u.origin).toString(),303);
      }
    })());
    return;
  }

  if(e.request.method!=='GET') return;

  // /shareを直接開いた場合も404にせずトップへ
  if(u.pathname.endsWith('/share')){
    e.respondWith(caches.match('./index.html').then(r=>r||fetch('./index.html')));
    return;
  }

  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
