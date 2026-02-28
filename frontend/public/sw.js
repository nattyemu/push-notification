// This will show a console.log in the MAIN window too
self.addEventListener("push", (event) => {
  const data = event.data.json();

  // This won't show in main console, but we'll use clients.matchAll
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

  // Show notification as normal
  return self.registration.showNotification(data.title, {
    body: data.body,
    icon: "/vite.svg",
  });
});

// Listen for messages from service worker in your React app
self.addEventListener("message", (event) => {
  console.log("Message from SW:", event.data);
});
