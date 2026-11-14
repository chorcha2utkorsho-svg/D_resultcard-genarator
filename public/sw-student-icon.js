/* D-Likon Model Academy — Student Passport Photo PWA Icon & Manifest Interceptor */
const STUDENT_ICON_CACHE = 'dlikon-student-pwa-cache-v1';

const ICON_PATHS = new Set([
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
]);

const MANIFEST_PATHS = new Set([
  '/manifest.webmanifest',
  '/manifest.json',
]);

function isStudentManifestRequest(pathname) {
  return MANIFEST_PATHS.has(pathname) || pathname.startsWith('/api/student-manifest/');
}

function isStudentIconRequest(pathname) {
  return ICON_PATHS.has(pathname) || pathname.startsWith('/api/student-icon/');
}

function dataUrlToUint8Array(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { mime: match[1], bytes };
  } catch {
    return null;
  }
}

async function storePersonalizedPwaAssets(payload) {
  if (!payload || !payload.studentId) return;
  const cache = await caches.open(STUDENT_ICON_CACHE);
  const encodedId = encodeURIComponent(payload.studentId);

  const entries = [
    {
      dataUrl: payload.icons && payload.icons.icon192,
      paths: ['/pwa-192x192.png', `/api/student-icon/${encodedId}/192.png`],
    },
    {
      dataUrl: payload.icons && payload.icons.icon512,
      paths: ['/pwa-512x512.png', `/api/student-icon/${encodedId}/512.png`],
    },
    {
      dataUrl: payload.icons && payload.icons.maskable512,
      paths: ['/pwa-maskable-512x512.png', `/api/student-icon/${encodedId}/maskable-512.png`],
    },
    {
      dataUrl: payload.icons && payload.icons.apple180,
      paths: ['/apple-touch-icon.png', `/api/student-icon/${encodedId}/apple-touch-icon.png`],
    },
  ];

  for (const item of entries) {
    if (!item.dataUrl) continue;
    const decoded = dataUrlToUint8Array(item.dataUrl);
    if (!decoded) continue;
    for (const targetPath of item.paths) {
      const response = new Response(decoded.bytes, {
        status: 200,
        headers: {
          'Content-Type': decoded.mime || 'image/png',
          'Cache-Control': 'no-cache, max-age=0',
          'X-Dlikon-Student-Icon': payload.studentId,
        },
      });
      await cache.put(targetPath, response);
    }
  }

  if (payload.manifestJson) {
    const manifestString =
      typeof payload.manifestJson === 'string'
        ? payload.manifestJson
        : JSON.stringify(payload.manifestJson);

    const rootManifestString = JSON.stringify({
      ...(typeof payload.manifestJson === 'string'
        ? JSON.parse(payload.manifestJson)
        : payload.manifestJson),
      id: '/',
      icons: [
        {
          src: `/pwa-192x192.png${payload.versionTag ? `?v=${payload.versionTag}` : ''}`,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: `/pwa-512x512.png${payload.versionTag ? `?v=${payload.versionTag}` : ''}`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: `/pwa-maskable-512x512.png${payload.versionTag ? `?v=${payload.versionTag}` : ''}`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    });

    for (const manifestPath of ['/manifest.webmanifest', '/manifest.json']) {
      await cache.put(
        manifestPath,
        new Response(rootManifestString, {
          status: 200,
          headers: {
            'Content-Type': 'application/manifest+json; charset=utf-8',
            'Cache-Control': 'no-cache, max-age=0',
            'X-Dlikon-Student-Manifest': payload.studentId,
          },
        })
      );
    }

    await cache.put(
      `/api/student-manifest/${encodedId}`,
      new Response(manifestString, {
        status: 200,
        headers: {
          'Content-Type': 'application/manifest+json; charset=utf-8',
          'Cache-Control': 'no-cache, max-age=0',
          'X-Dlikon-Student-Manifest': payload.studentId,
        },
      })
    );
  }
}

self.addEventListener('message', (event) => {
  const data = event && event.data;
  if (!data || !data.type) return;

  if (data.type === 'UPDATE_STUDENT_PWA_ICON') {
    const work = storePersonalizedPwaAssets(data.payload).then(async () => {
      const clientsList = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
      for (const client of clientsList) {
        client.postMessage({
          type: 'STUDENT_PWA_ICON_UPDATED',
          studentId: data.payload && data.payload.studentId,
          versionTag: data.payload && data.payload.versionTag,
        });
      }
    });
    if (typeof event.waitUntil === 'function') {
      event.waitUntil(work);
    }
  } else if (data.type === 'CLEAR_STUDENT_PWA_ICON') {
    const work = caches.delete(STUDENT_ICON_CACHE);
    if (typeof event.waitUntil === 'function') {
      event.waitUntil(work);
    }
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!req || req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) return;

  const isManifest = isStudentManifestRequest(url.pathname);
  const isIcon = isStudentIconRequest(url.pathname);
  if (!isManifest && !isIcon) return;

  // Prevent downstream Workbox handlers from racing event.respondWith on intercepted manifest/icon routes
  if (typeof event.stopImmediatePropagation === 'function') {
    event.stopImmediatePropagation();
  }

  event.respondWith(
    (async () => {
      try {
        const studentCache = await caches.open(STUDENT_ICON_CACHE);
        const personalized = await studentCache.match(url.pathname);
        if (personalized) {
          return personalized.clone();
        }
      } catch {
        // Ignore cache lookup failure and fall back cleanly
      }

      // When no personalized student icon/manifest is cached, check default precache/network
      try {
        const networkResp = await fetch(req);
        if (networkResp && networkResp.ok) {
          return networkResp;
        }
      } catch {
        // Offline fallback below
      }

      const fallbackMatch = await caches.match(req, { ignoreSearch: true });
      if (fallbackMatch) {
        return fallbackMatch;
      }

      return new Response(null, { status: 404, statusText: 'Not Found' });
    })()
  );
});
