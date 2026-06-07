import { useCallback, useEffect, useState } from "react";

const LS_KEY = "imphq.sidebar.favs";
const MAX_FAVS = 5;

function read(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_FAVS) : [];
  } catch {
    return [];
  }
}

function write(favs: string[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(favs.slice(0, MAX_FAVS)));
  } catch {}
}

export function useSidebarFavorites() {
  const [favorites, setFavorites] = useState<string[]>(read);

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === LS_KEY) setFavorites(read());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const isFavorite = useCallback(
    (url: string) => favorites.includes(url),
    [favorites]
  );

  const toggleFavorite = useCallback((url: string) => {
    setFavorites((prev) => {
      const next = prev.includes(url)
        ? prev.filter((u) => u !== url)
        : prev.length < MAX_FAVS
        ? [...prev, url]
        : prev; // already at limit — silently ignore
      write(next);
      return next;
    });
  }, []);

  return { favorites, isFavorite, toggleFavorite, maxFavs: MAX_FAVS };
}
