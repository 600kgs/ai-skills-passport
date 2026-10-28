"use client";

import { useEffect, useRef, useState } from "react";

// the server renders the real number; once it scrolls into view it runs up from zero.
// screen readers get the final number once, never the frames
export function CountUp({ to, ms = 1000 }: { to: number; ms?: number }) {
  const [n, setN] = useState(to);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / ms);
        setN(Math.round(to * (1 - (1 - p) ** 3)));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(frame); };
  }, [to, ms]);

  return (
    <>
      <span className="sr-only">{to}</span>
      <span ref={ref} aria-hidden className="tabular-nums">{n}</span>
    </>
  );
}
