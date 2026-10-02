export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  return Notification.requestPermission();
}

function decodeApplicationServerKey(key: string): ArrayBuffer {
  const padded = key + "=".repeat((4 - (key.length % 4)) % 4);
  const decoded = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes.buffer;
}

export async function enablePushNotifications(): Promise<NotificationPermission> {
  const permission = await requestNotificationPermission();
  if (permission !== "granted") return permission;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("This browser does not support push notifications.");
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  const keyResponse = await fetch("/api/push-subscription");
  if (!keyResponse.ok) throw new Error("Could not load the push configuration.");
  const { publicKey } = await keyResponse.json();
  if (!publicKey) throw new Error("The server is missing its VAPID public key.");

  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeApplicationServerKey(publicKey),
    }));

  const response = await fetch("/api/push-subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) throw new Error("Could not save this browser's push subscription.");
  return permission;
}
