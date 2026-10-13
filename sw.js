/* Bozi PWA Service Worker */
var CACHE_VERSION = 'bozi-v1.0.0';
var CACHE_NAME = CACHE_VERSION;

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll([
        './',
        './index.html',
        './manifest.json',
        './icon.svg'
      ]).catch(function(err){
        console.warn('SW addAll 部分资源失败:', err);
      });
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k !== CACHE_NAME) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch(err){ return; }
  if(url.origin !== location.origin) return;

  var isHTML = req.mode === 'navigate' ||
    ((req.headers.get('accept') || '').indexOf('text/html') > -1);

  if(isHTML){
    e.respondWith(
      fetch(req).then(function(res){
        if(res && res.status === 200){
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(req, clone); });
        }
        return res;
      }).catch(function(){
        return caches.match(req).then(function(r){
          return r || caches.match('./index.html');
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function(cached){
      if(cached) return cached;
      return fetch(req).then(function(res){
        if(res && res.status === 200 && res.type === 'basic'){
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(req, clone); });
        }
        return res;
      });
    })
  );
});
