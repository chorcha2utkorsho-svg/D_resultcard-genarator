import { Student } from '../types';

export interface GeneratedStudentIcons {
  icon192: string;
  icon512: string;
  maskable512: string;
  apple180: string;
  versionTag: string;
}

const iconCache = new Map<string, GeneratedStudentIcons>();
let lastAppliedKey = '';

export function getShortStudentAppName(nameBn?: string): string {
  const cleaned = (nameBn || '').trim();
  if (!cleaned) return 'ডি-লিকন';
  if (cleaned.length <= 12) return cleaned;
  const parts = cleaned.split(/\s+/);
  if (parts[0] && parts[0].length <= 12) {
    if (parts[1] && `${parts[0]} ${parts[1]}`.length <= 12) {
      return `${parts[0]} ${parts[1]}`;
    }
    return parts[0];
  }
  return cleaned.slice(0, 12);
}

function hashString(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load student avatar image'));
    img.src = src;
  });
}

function drawSquarePortraitIcon(img: HTMLImageElement, size: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Deep academy navy backdrop
  ctx.fillStyle = '#091e42';
  ctx.fillRect(0, 0, size, size);

  // Face-centered upper-biased square crop
  const cropSize = Math.min(img.width, img.height);
  const sx = Math.max(0, (img.width - cropSize) / 2);
  const sy = Math.max(0, (img.height - cropSize) * 0.16);

  const pad = Math.round(size * 0.05);
  const innerSize = size - pad * 2;
  const radius = Math.round(size * 0.16);

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, pad, innerSize, innerSize, radius);
  ctx.clip();
  ctx.drawImage(img, sx, sy, cropSize, cropSize, pad, pad, innerSize, innerSize);
  ctx.restore();

  // Crisp gold border ring
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = Math.max(3, Math.round(size * 0.03));
  ctx.beginPath();
  ctx.roundRect(pad, pad, innerSize, innerSize, radius);
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

function drawMaskablePortraitIcon(img: HTMLImageElement, size: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Full-bleed solid navy background for Android adaptive icon safe-zone
  ctx.fillStyle = '#091e42';
  ctx.fillRect(0, 0, size, size);

  const center = size / 2;
  // Keep portrait safely inside central ~74% diameter circle (13% padding on all sides)
  const avatarDiameter = Math.round(size * 0.72);
  const avatarRadius = avatarDiameter / 2;

  const cropSize = Math.min(img.width, img.height);
  const sx = Math.max(0, (img.width - cropSize) / 2);
  const sy = Math.max(0, (img.height - cropSize) * 0.16);

  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, avatarRadius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(
    img,
    sx,
    sy,
    cropSize,
    cropSize,
    center - avatarRadius,
    center - avatarRadius,
    avatarDiameter,
    avatarDiameter
  );
  ctx.restore();

  // Protective amber/gold halo ring
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = Math.max(6, Math.round(size * 0.025));
  ctx.beginPath();
  ctx.arc(center, center, avatarRadius, 0, Math.PI * 2);
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

export async function generateStudentAppIcons(student: Student): Promise<GeneratedStudentIcons | null> {
  if (typeof document === 'undefined' || !student.avatarUrl) return null;

  const versionTag = hashString(`${student.id}:${student.nameBn}:${student.avatarUrl.slice(0, 120)}:${student.avatarUrl.length}`);
  const cacheKey = `${student.id}_${versionTag}`;
  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

  try {
    const img = await loadImageElement(student.avatarUrl);
    const icons: GeneratedStudentIcons = {
      apple180: drawSquarePortraitIcon(img, 180),
      icon192: drawSquarePortraitIcon(img, 192),
      icon512: drawSquarePortraitIcon(img, 512),
      maskable512: drawMaskablePortraitIcon(img, 512),
      versionTag,
    };
    if (!icons.icon192 || !icons.icon512) return null;
    iconCache.set(cacheKey, icons);
    return icons;
  } catch {
    return null;
  }
}

function upsertHeadLink(rel: string, href: string, type?: string) {
  if (typeof document === 'undefined') return;
  let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  if (type) {
    link.type = type;
  }
  link.href = href;
}

const STUDENT_ICON_CACHE_NAME = 'dlikon-student-pwa-cache-v1';

function dataUrlToUint8Array(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
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

function buildStudentManifestObject(student: Student, versionTag: string) {
  const encodedId = encodeURIComponent(student.id);
  const startUrl = `/?guardian=${encodedId}&locked=1`;
  const studentName = (student.nameBn || '').trim();
  return {
    id: startUrl,
    name: studentName ? `${studentName} — ডি-লিকন ড্যাশবোর্ড` : 'ডি-লিকন মডেল একাডেমী',
    short_name: getShortStudentAppName(student.nameBn),
    description: studentName
      ? `${studentName}-এর ব্যক্তিগত শিক্ষার্থী ও অভিভাবক ড্যাশবোর্ড`
      : 'ডি-লিকন মডেল একাডেমী - ডিজিটাল রেজাল্ট ও অভিভাবক পোর্টাল',
    theme_color: '#091e42',
    background_color: '#091e42',
    display: 'standalone',
    start_url: startUrl,
    scope: '/',
    icons: [
      {
        src: `/api/student-icon/${encodedId}/192.png?v=${versionTag}`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `/api/student-icon/${encodedId}/512.png?v=${versionTag}`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `/api/student-icon/${encodedId}/maskable-512.png?v=${versionTag}`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

async function syncIconsAndManifestToServiceWorker(
  student: Student,
  icons: GeneratedStudentIcons | null,
  versionTag: string
): Promise<void> {
  if (typeof window === 'undefined') return;

  const manifestObj = buildStudentManifestObject(student, versionTag);
  const encodedId = encodeURIComponent(student.id);

  // 1. Write directly to shared CacheStorage so SW fetch interceptor serves immediately
  if ('caches' in window) {
    try {
      const cache = await caches.open(STUDENT_ICON_CACHE_NAME);
      if (icons) {
        const iconMap: { dataUrl: string; paths: string[] }[] = [
          { dataUrl: icons.icon192, paths: ['/pwa-192x192.png', `/api/student-icon/${encodedId}/192.png`] },
          { dataUrl: icons.icon512, paths: ['/pwa-512x512.png', `/api/student-icon/${encodedId}/512.png`] },
          {
            dataUrl: icons.maskable512,
            paths: ['/pwa-maskable-512x512.png', `/api/student-icon/${encodedId}/maskable-512.png`],
          },
          {
            dataUrl: icons.apple180,
            paths: ['/apple-touch-icon.png', `/api/student-icon/${encodedId}/apple-touch-icon.png`],
          },
        ];

        for (const item of iconMap) {
          const decoded = dataUrlToUint8Array(item.dataUrl);
          if (!decoded) continue;
          const blobCopy = new Uint8Array(decoded.bytes);
          for (const targetPath of item.paths) {
            await cache.put(
              targetPath,
              new Response(blobCopy, {
                status: 200,
                headers: {
                  'Content-Type': decoded.mime || 'image/png',
                  'Cache-Control': 'no-cache, max-age=0',
                  'X-Dlikon-Student-Icon': student.id,
                },
              })
            );
          }
        }
      }

      const rootManifest = JSON.stringify({
        ...manifestObj,
        id: '/',
        icons: [
          {
            src: `/pwa-192x192.png?v=${versionTag}`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `/pwa-512x512.png?v=${versionTag}`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `/pwa-maskable-512x512.png?v=${versionTag}`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      });

      for (const pathKey of ['/manifest.webmanifest', '/manifest.json']) {
        await cache.put(
          pathKey,
          new Response(rootManifest, {
            status: 200,
            headers: {
              'Content-Type': 'application/manifest+json; charset=utf-8',
              'Cache-Control': 'no-cache, max-age=0',
              'X-Dlikon-Student-Manifest': student.id,
            },
          })
        );
      }

      await cache.put(
        `/api/student-manifest/${encodedId}`,
        new Response(JSON.stringify(manifestObj), {
          status: 200,
          headers: {
            'Content-Type': 'application/manifest+json; charset=utf-8',
            'Cache-Control': 'no-cache, max-age=0',
            'X-Dlikon-Student-Manifest': student.id,
          },
        })
      );
    } catch {
      // Ignore Cache API errors in restricted contexts
    }
  }

  // 2. Notify active / ready Service Worker listener cleanly
  if ('serviceWorker' in navigator) {
    const messagePayload = {
      type: 'UPDATE_STUDENT_PWA_ICON',
      payload: {
        studentId: student.id,
        studentName: student.nameBn,
        shortName: getShortStudentAppName(student.nameBn),
        versionTag,
        manifestJson: manifestObj,
        icons: icons
          ? {
              icon192: icons.icon192,
              icon512: icons.icon512,
              maskable512: icons.maskable512,
              apple180: icons.apple180,
            }
          : null,
      },
    };

    try {
      navigator.serviceWorker.controller?.postMessage(messagePayload);
      const reg = await navigator.serviceWorker.ready;
      reg.active?.postMessage(messagePayload);
    } catch {
      // Ignore postMessage failure if SW is not active yet
    }
  }
}

export async function applyStudentPassportAppIcon(student: Student): Promise<{
  applied: boolean;
  hasAvatar: boolean;
  previewIconUrl: string;
}> {
  if (typeof document === 'undefined') {
    return { applied: false, hasAvatar: Boolean(student.avatarUrl), previewIconUrl: '/pwa-192x192.png' };
  }

  const shortName = getShortStudentAppName(student.nameBn);
  const appleMeta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
  if (appleMeta) {
    appleMeta.content = shortName;
  }

  const hasAvatar = Boolean(student.avatarUrl);
  const icons = hasAvatar ? await generateStudentAppIcons(student) : null;
  const versionTag = icons?.versionTag || hashString(`${student.id}:${student.nameBn}:default`);
  const appliedKey = `${student.id}:${versionTag}`;

  if (icons) {
    // Immediate tab favicon update
    upsertHeadLink('icon', icons.icon192, 'image/png');

    // Sync PNG icons to Service Worker & Cache Storage + Server API
    if (lastAppliedKey !== appliedKey) {
      await syncIconsAndManifestToServiceWorker(student, icons, versionTag);

      try {
        await fetch(`/api/student-icon/${encodeURIComponent(student.id)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            icon192: icons.icon192,
            icon512: icons.icon512,
            maskable512: icons.maskable512,
            apple180: icons.apple180,
            studentName: student.nameBn,
          }),
        });
      } catch {
        // Non-fatal: manifest & icon fallback still use server memoryDb avatar & SW CacheStorage
      }
    }

    const encodedId = encodeURIComponent(student.id);
    upsertHeadLink('apple-touch-icon', `/api/student-icon/${encodedId}/apple-touch-icon.png?v=${versionTag}`);
    upsertHeadLink(
      'manifest',
      `/api/student-manifest/${encodedId}?v=${versionTag}`,
      'application/manifest+json'
    );
    lastAppliedKey = appliedKey;

    return {
      applied: true,
      hasAvatar: true,
      previewIconUrl: icons.icon192,
    };
  }

  // No passport photo yet: still bind personalized manifest start_url for seamless locked launch
  if (lastAppliedKey !== appliedKey) {
    await syncIconsAndManifestToServiceWorker(student, null, versionTag);
  }
  const encodedId = encodeURIComponent(student.id);
  upsertHeadLink(
    'manifest',
    `/api/student-manifest/${encodedId}?v=${versionTag}`,
    'application/manifest+json'
  );
  lastAppliedKey = appliedKey;

  return {
    applied: true,
    hasAvatar: false,
    previewIconUrl: '/pwa-192x192.png',
  };
}

export function resetStudentAppIcon(): void {
  if (typeof document === 'undefined') return;
  lastAppliedKey = '';
  upsertHeadLink('icon', '/pwa-192x192.png', 'image/png');
  upsertHeadLink('apple-touch-icon', '/apple-touch-icon.png');
  upsertHeadLink('manifest', '/manifest.webmanifest', 'application/manifest+json');
  const appleMeta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
  if (appleMeta) {
    appleMeta.content = 'ডি-লিকন';
  }
  if ('caches' in window) {
    void caches.delete(STUDENT_ICON_CACHE_NAME);
  }
  if ('serviceWorker' in navigator) {
    try {
      navigator.serviceWorker.controller?.postMessage({ type: 'CLEAR_STUDENT_PWA_ICON' });
      void navigator.serviceWorker.ready.then((reg) => {
        reg.active?.postMessage({ type: 'CLEAR_STUDENT_PWA_ICON' });
      });
    } catch {
      // Ignore
    }
  }
}
