import type { Metric } from 'web-vitals';

function sendMetric(metric: Metric) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Web Vitals] ${metric.name}: ${Math.round(metric.value)}`, metric);
    return;
  }
  // In production, send to Sentry as a custom measurement
  try {
    import('./sentry').then(({ captureMessage }) => {
      captureMessage(`Web Vital: ${metric.name}`, {
        metric_name: metric.name,
        metric_value: metric.value,
        metric_rating: metric.rating,
      });
    });
  } catch {
    // Silently ignore if Sentry is not available
  }
}

export function initWebVitals() {
  import('web-vitals').then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
    onLCP(sendMetric);
    onINP(sendMetric);
    onCLS(sendMetric);
    onFCP(sendMetric);
    onTTFB(sendMetric);
  });
}
