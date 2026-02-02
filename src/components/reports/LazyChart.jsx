import React, { useState, useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const MAX_CHART_POINTS = 30;

/**
 * Hook: only render chart when element is in viewport to reduce lag from multiple Recharts.
 */
export function useChartInView(options = {}) {
  const { rootMargin = '100px', threshold = 0 } = options;
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { rootMargin, threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  return [ref, inView];
}

/**
 * Wrapper: shows skeleton until the wrapper is in viewport, then renders children.
 * Use one per chart card to avoid rendering 5 heavy charts at once.
 */
export function LazyChart({ children, skeleton }) {
  const [ref, inView] = useChartInView();

  return (
    <div ref={ref} className="min-h-[200px]">
      {inView ? children : (skeleton ?? <Skeleton className="h-full w-full min-h-[200px]" />)}
    </div>
  );
}

/**
 * Sample a date range to at most MAX_CHART_POINTS points to keep charts fast.
 * Returns array of indices to use (0, step, 2*step, ...) so we don't iterate 90 times in the chart.
 */
export function sampleDateIndices(totalDays, maxPoints = MAX_CHART_POINTS) {
  if (totalDays <= maxPoints) {
    return Array.from({ length: totalDays + 1 }, (_, i) => i);
  }
  const step = totalDays / maxPoints;
  const indices = [];
  for (let i = 0; i <= maxPoints; i++) {
    const idx = Math.min(Math.round(i * step), totalDays);
    if (indices.indexOf(idx) === -1) indices.push(idx);
  }
  return indices;
}

export { MAX_CHART_POINTS };
