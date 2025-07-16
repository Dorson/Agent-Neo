/**
 * Agent Neo Service Worker
 * 
 * Implements caching strategies and offline functionality for the
 * Agent Neo Progressive Web App as specified in the whitepaper.
 * 
 * Features:
 * - Cache-first strategy for static assets
 * - Network-first strategy for API calls
 * - Offline fallbacks
 * - Background sync for task queue
 * - Push notifications support
 */

const CACHE_NAME = 'agent-neo-v1.0.0';
const OFFLINE_CACHE = 'agent-neo-offline-v1.0.0';
const RUNTIME_CACHE = 'agent-neo-runtime-v1.0.0';

// Files to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/src/main.js',
    '/src/core/EventBus.js',
    '/src/core/StateManager.js',
    '/src/core/AgentNeo.js',
    '/src/ui/UIManager.js',
    '/src/styles/reset.css',
    '/src/styles/variables.css',
    '/src/styles/main.css',
    '/src/styles/components.css',
    '/src/styles/themes.css',
    '/assets/icons/icon-192x192.png',
    '/assets/icons/icon-512x512.png'
];

// Routes that should work offline
const OFFLINE_FALLBACK_ROUTES = [
    '/dashboard',
    '/chat',
    '/network',
    '/settings',
    '/analytics'
];

// API endpoints that need network-first strategy
const API_ROUTES = [
    '/api/',
    '/p2p/',
    '/ipfs/',
    '/sync/'
];

self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker v' + CACHE_NAME);
    
    event.waitUntil(
        Promise.all([
            // Cache static assets
            caches.open(CACHE_NAME).then((cache) => {
                return cache.addAll(STATIC_ASSETS);
            }),
            
            // Cache offline fallback page
            caches.open(OFFLINE_CACHE).then((cache) => {
                return cache.add('/offline.html');
            })
        ]).then(() => {
            console.log('[SW] Installation complete');
            // Force activation of new service worker
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker v' + CACHE_NAME);
    
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && 
                            cacheName !== OFFLINE_CACHE && 
                            cacheName !== RUNTIME_CACHE) {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            
            // Take control of all clients
            self.clients.claim()
        ]).then(() => {
            console.log('[SW] Activation complete');
        })
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension and other non-http(s) schemes
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    // Handle different types of requests
    if (isAPIRequest(url)) {
        // Network-first strategy for API calls
        event.respondWith(handleAPIRequest(request));
    } else if (isStaticAsset(url)) {
        // Cache-first strategy for static assets
        event.respondWith(handleStaticAsset(request));
    } else {
        // Stale-while-revalidate for navigation requests
        event.respondWith(handleNavigationRequest(request));
    }
});

// Handle API requests with network-first strategy
async function handleAPIRequest(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[SW] Network failed for API request, trying cache:', request.url);
        
        // Fallback to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline response for API calls
        return new Response(
            JSON.stringify({ 
                error: 'Offline', 
                message: 'This request requires an internet connection',
                offline: true,
                timestamp: Date.now()
            }),
            {
                status: 503,
                statusText: 'Service Unavailable',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            }
        );
    }
}

// Handle static assets with cache-first strategy
async function handleStaticAsset(request) {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        // Fetch from network and cache
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[SW] Failed to fetch static asset:', request.url);
        
        // Return a fallback response for images
        if (request.destination === 'image') {
            return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f0f0f0"/><text x="100" y="100" text-anchor="middle" dy=".3em" font-family="Arial" font-size="14" fill="#666">Image Unavailable</text></svg>',
                {
                    headers: {
                        'Content-Type': 'image/svg+xml',
                        'Cache-Control': 'no-cache'
                    }
                }
            );
        }
        
        throw error;
    }
}

// Handle navigation requests with stale-while-revalidate
async function handleNavigationRequest(request) {
    try {
        // Try cache first for faster response
        const cachedResponse = await caches.match(request);
        
        // Fetch from network in background
        const networkResponsePromise = fetch(request).then(response => {
            if (response.ok) {
                const cache = caches.open(RUNTIME_CACHE);
                cache.then(c => c.put(request, response.clone()));
            }
            return response;
        }).catch(() => null);
        
        // Return cached response immediately if available
        if (cachedResponse) {
            // Update cache in background
            networkResponsePromise.catch(() => {});
            return cachedResponse;
        }
        
        // Wait for network response if no cache
        const networkResponse = await networkResponsePromise;
        if (networkResponse) {
            return networkResponse;
        }
        
        // Fallback to offline page
        return await caches.match('/offline.html') || 
               new Response('Offline', { status: 503 });
               
    } catch (error) {
        console.log('[SW] Navigation request failed:', request.url);
        
        // Return offline fallback
        const offlineResponse = await caches.match('/offline.html');
        return offlineResponse || new Response('Offline', { status: 503 });
    }
}

// Background sync for task queue
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync triggered:', event.tag);
    
    if (event.tag === 'task-queue-sync') {
        event.waitUntil(syncTaskQueue());
    } else if (event.tag === 'settings-sync') {
        event.waitUntil(syncSettings());
    }
});

// Push notification handling
self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received');
    
    const options = {
        body: 'Agent Neo has an update for you',
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/icon-72x72.png',
        tag: 'agent-neo-notification',
        data: {
            timestamp: Date.now(),
            url: '/'
        },
        actions: [
            {
                action: 'open',
                title: 'Open Agent Neo',
                icon: '/assets/icons/icon-96x96.png'
            },
            {
                action: 'dismiss',
                title: 'Dismiss',
                icon: '/assets/icons/icon-96x96.png'
            }
        ],
        requireInteraction: false,
        silent: false
    };
    
    let title = 'Agent Neo';
    let body = options.body;
    
    if (event.data) {
        try {
            const payload = event.data.json();
            title = payload.title || title;
            body = payload.body || body;
            options.data = { ...options.data, ...payload.data };
        } catch (error) {
            console.log('[SW] Failed to parse push payload:', error);
        }
    }
    
    event.waitUntil(
        self.registration.showNotification(title, { ...options, body })
    );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event.notification.tag);
    
    event.notification.close();
    
    if (event.action === 'dismiss') {
        return;
    }
    
    // Open or focus the app
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            // Check if Agent Neo is already open
            for (const client of clientList) {
                if (client.url.includes('agent-neo') && 'focus' in client) {
                    return client.focus();
                }
            }
            
            // Open new window
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

// Message handling from main thread
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);
    
    const { type, payload } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'GET_VERSION':
            event.ports[0].postMessage({ version: CACHE_NAME });
            break;
            
        case 'CLEAR_CACHE':
            clearAllCaches().then(() => {
                event.ports[0].postMessage({ success: true });
            });
            break;
            
        case 'CACHE_TASK':
            cacheTask(payload).then(() => {
                event.ports[0].postMessage({ success: true });
            });
            break;
    }
});

// Utility functions
function isAPIRequest(url) {
    return API_ROUTES.some(route => url.pathname.startsWith(route));
}

function isStaticAsset(url) {
    return url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico)$/);
}

async function syncTaskQueue() {
    try {
        console.log('[SW] Syncing task queue...');
        
        // Get queued tasks from IndexedDB
        const tasks = await getQueuedTasks();
        
        for (const task of tasks) {
            try {
                const response = await fetch('/api/tasks', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(task)
                });
                
                if (response.ok) {
                    await removeTaskFromQueue(task.id);
                    console.log('[SW] Task synced successfully:', task.id);
                }
            } catch (error) {
                console.log('[SW] Failed to sync task:', task.id, error);
            }
        }
    } catch (error) {
        console.log('[SW] Task queue sync failed:', error);
    }
}

async function syncSettings() {
    try {
        console.log('[SW] Syncing settings...');
        
        // Implementation would sync settings with remote storage
        // For now, just log that sync was attempted
        
    } catch (error) {
        console.log('[SW] Settings sync failed:', error);
    }
}

async function getQueuedTasks() {
    // Implementation would read from IndexedDB
    // Return empty array for now
    return [];
}

async function removeTaskFromQueue(taskId) {
    // Implementation would remove task from IndexedDB
    console.log('[SW] Removing task from queue:', taskId);
}

async function cacheTask(task) {
    try {
        const cache = await caches.open(RUNTIME_CACHE);
        const response = new Response(JSON.stringify(task), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        await cache.put(`/tasks/${task.id}`, response);
        console.log('[SW] Task cached:', task.id);
    } catch (error) {
        console.log('[SW] Failed to cache task:', error);
    }
}

async function clearAllCaches() {
    try {
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('[SW] All caches cleared');
    } catch (error) {
        console.log('[SW] Failed to clear caches:', error);
    }
}

// Error handling
self.addEventListener('error', (event) => {
    console.error('[SW] Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('[SW] Service Worker unhandled rejection:', event.reason);
});

console.log('[SW] Service Worker loaded:', CACHE_NAME);