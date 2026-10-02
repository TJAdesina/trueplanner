import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Checkin } from "@/lib/types";

export async function sendCheckinPush(supabase: SupabaseClient, checkin: Checkin) {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    console.error("Push notifications are not configured: VAPID environment variables are missing.");
    return;
  }

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, subscription")
    .eq("user_id", checkin.user_id);
  if (error) {
    console.error("Could not load browser push subscriptions.", error);
    return;
  }
  if (!subscriptions?.length) {
    console.warn(`No browser push subscriptions are registered for user ${checkin.user_id}.`);
    return;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const payload = JSON.stringify({
    title: `TruePlanner - ${checkin.headline}`,
    body: `${checkin.message}\n\nCut it · Shrink it · Move it`,
    tag: checkin.id,
    url: "/dashboard",
  });

  await Promise.all(
    subscriptions.map(async ({ endpoint, subscription }) => {
      try {
        await webpush.sendNotification(subscription, payload);
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
        } else {
          console.error("Could not deliver a check-in push notification.", error);
        }
      }
    })
  );
}