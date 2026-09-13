"use client";

import { useEffect, useRef, ReactNode } from "react";

interface RevealSectionProps {
  children: ReactNode;
  className?: string;
  /** Stagger-reveal each direct child with a 100ms gap */
  stagger?: boolean;
  /** Extra delay (ms) before the first item reveals */
  delay?: number;
}

export function RevealSection({
  children,
  className = "",
  stagger = false,
  delay = 0,
}: RevealSectionProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (stagger) {
      // Mark every direct child so they start hidden
      Array.from(el.children).forEach((child) => {
        child.classList.add("reveal");
      });
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        if (stagger) {
          Array.from(el.children).forEach((child, i) => {
            setTimeout(() => child.classList.add("revealed"), delay + i * 100);
          });
        } else {
          if (delay > 0) {
            setTimeout(() => el.classList.add("revealed"), delay);
          } else {
            el.classList.add("revealed");
          }
        }
        observer.disconnect();
      },
      { threshold: 0.08, rootMargin: "0px 0px -50px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [stagger, delay]);

  return (
    <div
      ref={ref}
      className={stagger ? className : `reveal ${className}`}
    >
      {children}
    </div>
  );
}
