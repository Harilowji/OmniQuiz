/**
 * sw.js - OmniQuiz Pro Progressive Web App Service Worker
 * Implements high-resilience Offline Caching & Stale-While-Revalidate strategy
 */

const CACHE_NAME = 'omniquiz-pro-v1';

const PRECACHE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './assets/logo.png',
    './buzz.wav',
    './ding.wav',
    './css/main.css',
    './css/themes.css',
    './css/components.css',
    './css/animations.css',
    './js/i18n.js',
    './js/audio.js',
    './js/storage.js',
    './js/confetti.js',
    './js/sample-banks.js',
    './js/parser.js',
    './js/quiz-engine.js',
    './js/ui.js',
    './js/app.js'
];

// Install Event - Precache core local assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Precaching core assets');
            return cache.addAll(PRECACHE_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// Activate Event - Clean up stale caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        console.log('[SW] Purging old cache:', name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event - Stale-While-Revalidate for local assets, Cache-First for external CDNs & Fonts
self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Cache-First for static external CDNs (MathJax, PDF.js, Mammoth, Google Fonts)
    if (
        url.hostname.includes('cdnjs.cloudflare.com') ||
        url.hostname.includes('cdn.jsdelivr.net') ||
        url.hostname.includes('fonts.googleapis.com') ||
        url.hostname.includes('fonts.gstatic.com')
    ) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;

                return fetch(request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                    return cachedResponse || new Response('Offline resource not available', { status: 503 });
                });
            })
        );
        return;
    }

    // Stale-While-Revalidate for local assets
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            const fetchPromise = fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => cachedResponse);

            return cachedResponse || fetchPromise;
        })
    );
});
