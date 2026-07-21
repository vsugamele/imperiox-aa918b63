import { useEffect, useRef, useState } from "react";
import { useReactFlow, useStore } from "@xyflow/react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Cursor = { x: number; y: number; name: string; color: string; ts: number };

const COLORS = ["#c9922a", "#e94560", "#4ade80", "#60a5fa", "#f472b6", "#a78bfa"];

function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function PresenceCursors({ mapId }: { mapId: string }) {
  const { user } = useAuth();
  const { screenToFlowPosition, flowToScreenPosition } = useReactFlow();
  const [cursors, setCursors] = useState<Record<string, Cursor>>({});
  const channelRef = useRef<any>(null);
  const lastSent = useRef(0);
  // subscribe to viewport changes so cursors reproject on pan/zoom
  useStore((s) => `${s.transform[0]}:${s.transform[1]}:${s.transform[2]}`);

  useEffect(() => {
    if (!mapId || !user) return;
    const name =
      (user.user_metadata as any)?.full_name ||
      (user.user_metadata as any)?.name ||
      user.email?.split("@")[0] ||
      "Você";
    const color = colorFor(user.id);
    const ch = supabase.channel(`map-presence-${mapId}`, {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "cursor" }, ({ payload }) => {
      if (!payload || payload.userId === user.id) return;
      setCursors((prev) => ({
        ...prev,
        [payload.userId]: {
          x: payload.x,
          y: payload.y,
          name: payload.name,
          color: payload.color,
          ts: Date.now(),
        },
      }));
    });
    ch.on("broadcast", { event: "leave" }, ({ payload }) => {
      setCursors((prev) => {
        const n = { ...prev };
        delete n[payload.userId];
        return n;
      });
    });
    ch.subscribe();
    channelRef.current = ch;

    const onMove = (e: MouseEvent) => {
      const now = performance.now();
      if (now - lastSent.current < 60) return;
      lastSent.current = now;
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      ch.send({
        type: "broadcast",
        event: "cursor",
        payload: { userId: user.id, name, color, x: pos.x, y: pos.y },
      });
    };
    window.addEventListener("mousemove", onMove);

    const cleanupInt = window.setInterval(() => {
      const cutoff = Date.now() - 8000;
      setCursors((prev) => {
        const n: Record<string, Cursor> = {};
        Object.entries(prev).forEach(([k, v]) => {
          if (v.ts > cutoff) n[k] = v;
        });
        return n;
      });
    }, 2000);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.clearInterval(cleanupInt);
      ch.send({ type: "broadcast", event: "leave", payload: { userId: user.id } });
      supabase.removeChannel(ch);
    };
  }, [mapId, user, screenToFlowPosition]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {Object.entries(cursors).map(([id, c]) => {
        const s = flowToScreenPosition({ x: c.x, y: c.y });
        return (
          <div
            key={id}
            className="absolute transition-transform duration-75"
            style={{ transform: `translate(${s.x}px, ${s.y}px)` }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill={c.color}>
              <path d="M2 2 L2 14 L6 10 L9 16 L11 15 L8 9 L14 9 Z" stroke="#000" strokeWidth="0.6" />
            </svg>
            <span
              className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-black"
              style={{ background: c.color }}
            >
              {c.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
