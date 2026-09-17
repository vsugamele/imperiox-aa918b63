import { useEffect, useState } from "react";

export function useViewportWidth() {
  const [width, setWidth] = useState<number>(() =>
    typeof window !== "undefined" ? window.innerWidth : 1920
  );

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return width;
}
