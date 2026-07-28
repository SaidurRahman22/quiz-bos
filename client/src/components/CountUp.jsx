import { useEffect, useRef, useState } from 'react';

// Animated count-up used by the dashboard stat tiles.
export default function CountUp({ value = 0, duration = 900, decimals = 0, suffix = '' }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const step = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(from + (value - from) * eased);
      if (p < 1) raf.current = requestAnimationFrame(step);
      else setDisplay(value);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);

  return (
    <>
      {display.toFixed(decimals)}
      {suffix}
    </>
  );
}
