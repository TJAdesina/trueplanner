import type { Checkin } from "./types";

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

/** Fires a native browser notification for a check-in, if permitted. */
export function notifyCheckin(checkin: Checkin) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;

  const n = new Notification(`TruePlanner \u2014 ${checkin.headline}`, {
    body: `${checkin.message}\n\nCut it \u00b7 Shrink it \u00b7 Move it`,
    tag: checkin.id,
    icon: "/favicon.svg",
    silent: false,
  });

  n.onclick = () => {
    window.focus();
    n.close();
  };
}
