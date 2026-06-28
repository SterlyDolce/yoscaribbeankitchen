self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let notification = {
      body: "Open your order tracker for the latest update.",
      icon: "/pwa-icon.png",
      tag: "yos-order-update",
      title: "Yo's order update",
      url: "/account"
    };

    try {
      const response = await fetch("/api/orders/latest-status", {
        cache: "no-store",
        credentials: "include"
      });

      if (response.ok) {
        const result = await response.json();

        notification = {
          body: result.order?.body || notification.body,
          icon: "/pwa-icon.png",
          tag: `yos-order-${result.order?.id || "update"}`,
          title: result.order?.title || notification.title,
          url: result.order?.url || notification.url
        };
      }
    } catch (error) {
      // Show the generic notification if the status fetch fails.
    }

    await self.registration.showNotification(notification.title, {
      badge: "/pwa-icon.png",
      body: notification.body,
      data: { url: notification.url },
      icon: notification.icon,
      tag: notification.tag
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || "/account", self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await clients.matchAll({ includeUncontrolled: true, type: "window" });
    const existingWindow = windows.find((client) => client.url === targetUrl);

    if (existingWindow) {
      await existingWindow.focus();
      return;
    }

    await clients.openWindow(targetUrl);
  })());
});
