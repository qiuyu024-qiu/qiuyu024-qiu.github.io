/* 选题灵感工作台 · Service Worker
 * 策略：network-first（网络优先）——重新部署后手机打开即拿最新内容
 * 联网时优先请求网络并写入缓存；离线/失败才回退缓存（依旧可离线看）
 * 不再需要手动 bump 版本号；检测到新 sw.js 浏览器会自动安装新版
 */
const CACHE = "wb-workbench-v8";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app-data.js",
  "./script.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // 只管同源资源
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
