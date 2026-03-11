"use client";

import { useEffect, useRef } from "react";

interface LiveTickerProps {
  items: string[];
  isVisible: boolean;
}

export default function LiveTicker({ items, isVisible }: LiveTickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible || !scrollRef.current) return;

    const el = scrollRef.current;
    let animationId: number;
    let scrollPos = 0;

    const scroll = () => {
      scrollPos += 0.5;
      if (scrollPos >= el.scrollWidth / 2) {
        scrollPos = 0;
      }
      el.scrollLeft = scrollPos;
      animationId = requestAnimationFrame(scroll);
    };

    animationId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animationId);
  }, [isVisible, items]);

  if (!isVisible || items.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-indblue/95 backdrop-blur-sm border-t border-saffron/20">
      <div
        ref={scrollRef}
        className="flex items-center gap-8 py-2.5 px-4 overflow-hidden whitespace-nowrap"
      >
        {/* Duplicate items for seamless looping */}
        {[...items, ...items].map((item, i) => (
          <span
            key={i}
            className="text-xs font-mono text-white/90 flex items-center gap-2 shrink-0"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-saffron animate-pulse" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
