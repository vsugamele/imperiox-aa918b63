import { supabase } from "@/integrations/supabase/client";

const FALLBACK_VAPID_PUBLIC_KEY =
  "BLSx5jJeDYyBAq6dIN18oTfD0sv8JjSWGeQ0N8z0P74SJLrRcO_DMDFh9oPP5Yf0t0F-ZlciudxgCigyLQ3Toyo";

export type PushStatus = "unsupported" | "denied" | "subscribed" | "supported";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function isStandalonePwa() {
  return window.matchMedia?.("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
}

export function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isPreviewRuntime() {
  const host = window.location.hostname;
  const previewHost = host.includes("id-preview--") || host.includes("lovableproject.com");
  let iframe = false;
  try {
    iframe = window.self !== window.top;
  } catch {
    iframe = true;
  }
  return previewHost || iframe;
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription ? "subscribed" : "supported";
  } catch {
    return "supported";
  }
}

export async function ensurePushServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;

  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;

  return navigator.serviceWorker.register("/sw-push.js", { scope: "/" });
}

function getDeviceName() {
  if (isIOSDevice()) return "iPhone/iPad";
  if (/Android/i.test(navigator.userAgent)) return "Android";
  if (/Windows/i.test(navigator.userAgent)) return "Windows";
  if (/Macintosh|Mac OS/i.test(navigator.userAgent)) return "Mac";
  return "Navegador";
}

function getPlatform() {
  if (isIOSDevice()) return "ios";
  if (/Android/i.test(navigator.userAgent)) return "android";
  if (/Windows/i.test(navigator.userAgent)) return "windows";
  if (/Macintosh|Mac OS/i.test(navigator.userAgent)) return "macos";
  return "web";
}

export async function subscribeCurrentDevice() {
  if (!isPushSupported()) throw new Error("Este navegador nao suporta push.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permissao de notificacao nao concedida.");

  const registration = (await ensurePushServiceWorker()) || (await navigator.serviceWorker.ready);
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        (import.meta.env.VITE_VAPID_PUBLIC_KEY as string) || FALLBACK_VAPID_PUBLIC_KEY,
      ) as BufferSource,
    }));

  const json = subscription.toJSON();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !json.endpoint || !json.keys) {
    throw new Error("Usuario ou subscription invalida.");
  }

  await (supabase.from("imphq_push_subscriptions") as any).upsert(
    {
      user_id: user.id,
      endpoint: json.endpoint,
      keys_p256dh: json.keys.p256dh || "",
      keys_auth: json.keys.auth || "",
      device_name: getDeviceName(),
      platform: getPlatform(),
      user_agent: navigator.userAgent,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,endpoint" },
  );

  return subscription;
}

export async function unsubscribeCurrentDevice() {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await (supabase.from("imphq_push_subscriptions") as any)
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);
  }
}
