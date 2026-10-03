// Bản cũ dùng service worker để chạy offline. Bản mới đồng bộ qua máy chủ nên gỡ service worker cũ
// và xóa bộ nhớ đệm để mọi máy luôn tải phiên bản mới nhất.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.registration.unregister();
    const list = await self.clients.matchAll({ type: 'window' });
    list.forEach(c => { try { c.navigate(c.url); } catch (err) { /* bỏ qua */ } });
  })());
});
