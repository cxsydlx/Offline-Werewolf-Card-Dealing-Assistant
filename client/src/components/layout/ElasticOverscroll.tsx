import { useRef, useState, useCallback, type ReactNode, type TouchEvent } from "react";

export default function ElasticOverscroll({ children }: { children: ReactNode }) {
  const [offset, setOffset] = useState(0);
  const [animating, setAnimating] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY !== 0) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0 && window.scrollY === 0) {
      // 弹性阻力：越拉越难拉
      const resistance = Math.min(dy * 0.35, 120);
      setOffset(resistance);
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!pulling.current) return;
    pulling.current = false;
    if (offset > 0) {
      setAnimating(true);
      setOffset(0);
      setTimeout(() => setAnimating(false), 500);
    }
  }, [offset]);

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        transform: `translateY(${offset}px)`,
        transition: animating ? "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)" : "none",
        willChange: offset > 0 ? "transform" : "auto",
      }}
    >
      {children}
    </div>
  );
}
