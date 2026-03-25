import { useEffect } from 'react';

const FAVICON_FRAME_URLS = ['/assets/favicon-frame-0.png', '/assets/favicon-frame-1.png'] as const;
const FAVICON_SELECTOR = 'link[data-sogojet-favicon="true"]';
const FRAME_DURATION_MS = 950;

function ensureFaviconLinks() {
  const existing = Array.from(document.querySelectorAll<HTMLLinkElement>(FAVICON_SELECTOR));

  if (existing.length > 0) {
    return existing;
  }

  return ['icon', 'shortcut icon'].map((rel) => {
    const link = document.createElement('link');
    link.rel = rel;
    link.type = 'image/png';
    link.href = FAVICON_FRAME_URLS[0];
    link.setAttribute('data-sogojet-favicon', 'true');

    if (rel === 'icon') {
      link.sizes = '64x64';
    }

    document.head.appendChild(link);
    return link;
  });
}

export default function useAnimatedFavicon() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
    const faviconLinks = ensureFaviconLinks();
    let frameIndex = 0;
    let intervalId: number | null = null;

    const applyFrame = (index: number) => {
      const href = FAVICON_FRAME_URLS[index];
      faviconLinks.forEach((link) => {
        link.href = href;
      });
    };

    const stop = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }

      frameIndex = 0;
      applyFrame(frameIndex);
    };

    const start = () => {
      if (intervalId !== null || document.hidden || motionQuery?.matches) {
        return;
      }

      intervalId = window.setInterval(() => {
        frameIndex = (frameIndex + 1) % FAVICON_FRAME_URLS.length;
        applyFrame(frameIndex);
      }, FRAME_DURATION_MS);
    };

    const syncAnimation = () => {
      if (document.hidden || motionQuery?.matches) {
        stop();
        return;
      }

      start();
    };

    const handleMotionChange = () => {
      syncAnimation();
    };

    applyFrame(0);
    syncAnimation();
    document.addEventListener('visibilitychange', syncAnimation);

    if (motionQuery) {
      if (typeof motionQuery.addEventListener === 'function') {
        motionQuery.addEventListener('change', handleMotionChange);
      } else {
        motionQuery.addListener(handleMotionChange);
      }
    }

    return () => {
      stop();
      document.removeEventListener('visibilitychange', syncAnimation);

      if (motionQuery) {
        if (typeof motionQuery.removeEventListener === 'function') {
          motionQuery.removeEventListener('change', handleMotionChange);
        } else {
          motionQuery.removeListener(handleMotionChange);
        }
      }
    };
  }, []);
}
