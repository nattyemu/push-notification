self.addEventListener("push", (event) => {
  // console.log("📱 Push received in Service Worker");

  let data = {};

  try {
    data = event.data.json();
    // console.log("Push data:", data);
  } catch (e) {
    data = {
      title: "New Notification",
      body: "You have a new message",
      icon: "/notification.svg",
    };
  }

  // Show notification
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/notification.svg",
      badge: "/notification.svg",
      data: data.data || {},
      actions: data.actions || [{ action: "open", title: "Open" }],
      vibrate: [200, 100, 200],
      requireInteraction: true,
    }),
  );

  // Notify all open windows
  event.waitUntil(
    clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: "PUSH_RECEIVED",
          data: data,
        });
      });
    }),
  );
});

// 2. WHEN USER CLICKS NOTIFICATION
self.addEventListener("notificationclick", (event) => {
  // console.log("👆 Notification clicked:", event.action);
  // console.log("Notification data:", event.notification.data);

  event.notification.close();

  const action = event.action;
  const orderId = event.notification.data?.orderId;
  const urlToOpen = "http://localhost:5173";

  // Handle different actions
  if (action === "dismiss") {
    // console.log("❌ Notification dismissed");
    return;
  }

  // For 'view_order' action or default click
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // If app is open, focus it
      for (const client of clientList) {
        if (client.url.includes("localhost:5173") && "focus" in client) {
          client.postMessage({
            type: "OPEN_ORDER",
            orderId: orderId,
          });
          return client.focus();
        }
      }
      // If app is closed, open it
      return clients.openWindow(urlToOpen).then((newClient) => {
        if (newClient && orderId) {
          setTimeout(() => {
            newClient.postMessage({
              type: "OPEN_ORDER",
              orderId: orderId,
            });
          }, 1000);
        }
      });
    }),
  );
});

// 3. INSTALL/ACTIVATE EVENTS
self.addEventListener("install", (event) => {
  // console.log("🔧 Service Worker installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // console.log("✅ Service Worker activated");
  return self.clients.claim();
});
