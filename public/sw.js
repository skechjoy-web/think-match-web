// Lưu toàn bộ tệp của trò chơi để chạy được cả khi mất mạng
const CACHE='think-match-v1';
const FILES=["./", "index.html", "manifest.webmanifest", "assets/assets.js", "assets/bg.jpg", "assets/logo.png", "assets/icon-192.png", "assets/icon-512.png", "assets/shoes/01.jpg", "assets/shoes/02.jpg", "assets/shoes/03.jpg", "assets/shoes/04.jpg", "assets/shoes/05.jpg", "assets/shoes/06.jpg", "assets/shoes/07.jpg", "assets/shoes/08.jpg", "assets/shoes/09.jpg", "assets/shoes/10.jpg", "assets/shoes/11.jpg", "assets/shoes/12.jpg", "assets/shoes/13.jpg", "assets/shoes/14.jpg", "assets/shoes/15.jpg"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
// Ưu tiên bản mới từ máy chủ local, mất kết nối thì dùng bản đã lưu
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp))}return r}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('index.html'))))});
