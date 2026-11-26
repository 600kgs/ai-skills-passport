"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

// a sideways row of workshop cards: swipe on a phone (the next card peeks in), arrows on a desktop.
// it never moves by itself, so nobody loses the card they are reading
export function WorkshopCarousel({ children, labels }: { children: ReactNode[]; labels: { prev: string; next: string; region: string } }) {
  const row = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = row.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener("scroll", measure); };
  }, [measure]);

  const step = (dir: 1 | -1) => {
    const el = row.current;
    const card = el?.querySelector("li");
    if (!el || !card) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * (card.getBoundingClientRect().width + 32), behavior: reduce ? "auto" : "smooth" });
  };

  const arrow = "flex size-12 items-center justify-center border-2 border-ink bg-white font-display text-2xl text-ink hover:bg-ink hover:text-white disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-ink";
  const scrolls = !(edges.start && edges.end);
  return (
    <div role="region" aria-roledescription="carousel" aria-label={labels.region}>
      {scrolls && (
        <div className="mb-4 hidden justify-end gap-2 sm:flex">
          <button type="button" onClick={() => step(-1)} disabled={edges.start} aria-label={labels.prev} className={arrow}>←</button>
          <button type="button" onClick={() => step(1)} disabled={edges.end} aria-label={labels.next} className={arrow}>→</button>
        </div>
      )}
      <ul ref={row}
        className="-mx-4 flex snap-x snap-mandatory gap-8 overflow-x-auto scroll-px-4 px-4 pb-2 [contain:paint] [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {children.map((child, i) => (
          <li key={i} className="w-[85%] shrink-0 snap-start sm:w-[calc(50%-1rem)]">{child}</li>
        ))}
      </ul>
    </div>
  );
}
