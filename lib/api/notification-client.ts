interface NotificationPayload {
  title: string;
  body: string;
  level: "info" | "warning" | "critical";
  stockCode?: string;
}

export async function sendNotification(
  payload: NotificationPayload
): Promise<boolean> {
  const url = process.env.NOTIFICATION_WEBHOOK_URL;
  if (!url) return false;

  try {
    const isBark = url.includes("api.day.app");

    if (isBark) {
      const barkLevel =
        payload.level === "critical" ? "timeSensitive" : "active";
      const barkUrl = `${url}/${encodeURIComponent(payload.title)}/${encodeURIComponent(payload.body)}?level=${barkLevel}`;
      const res = await fetch(barkUrl, { method: "GET" });
      return res.ok;
    }

    // Generic webhook
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: payload.title,
        body: payload.body,
        level: payload.level,
        stockCode: payload.stockCode,
        timestamp: new Date().toISOString(),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
