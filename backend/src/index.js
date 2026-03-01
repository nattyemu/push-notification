import express from "express";
import cors from "cors";
import prisma from "../utils/prisma.js";
import webpush from "web-push";
import dotenv from "dotenv";
import http from "http";
import WebSocketManager from "../websocket.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// Initialize WebSocket Manager
const wsManager = new WebSocketManager(server);

// Middleware
app.use(cors());
app.use(express.json());

// Setup VAPID keys
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

// PUSH NOTIFICATION ROUTES (Your existing code)

app.get("/api/vapid-public-key", (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

app.post("/api/subscribe/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const { endpoint, keys } = req.body;

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({ data: { email } });
    }

    // Check if subscription already exists
    const existing = await prisma.pushSubscription.findFirst({
      where: { endpoint },
    });

    if (existing) {
      return res.json({ success: true, message: "Already subscribed" });
    }

    const subscription = await prisma.pushSubscription.create({
      data: {
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userId: user.id,
      },
    });

    res.json({ success: true, subscription });
  } catch (error) {
    console.error("Subscribe error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/send/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const { title, body, orderId } = req.body; // Add orderId

    const user = await prisma.user.findUnique({
      where: { email },
      include: { subscriptions: true },
    });

    if (!user || user.subscriptions.length === 0) {
      return res.status(404).json({ error: "No subscriptions found" });
    }

    const payload = JSON.stringify({
      title: title || "New Notification",
      body: body || "You have a new message",
      icon: "/vite.svg",
      data: {
        // This will be available in event.notification.data
        orderId: orderId,
        url: "http://localhost:5173/orders",
        timestamp: Date.now(),
      },
      actions: [
        // Add action buttons
        {
          action: "view_order",
          title: "View message",
        },
        {
          action: "dismiss",
          title: "Dismiss",
        },
      ],
    });

    const results = await Promise.allSettled(
      user.subscriptions.map((sub) => {
        const subscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };
        return webpush.sendNotification(subscription, payload);
      }),
    );

    res.json({
      success: true,
      sent: results.filter((r) => r.status === "fulfilled").length,
      failed: results.filter((r) => r.status === "rejected").length,
    });
  } catch (error) {
    console.error("Send error:", error);
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/subscriptions/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { subscriptions: true },
    });

    res.json(user?.subscriptions || []);
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    res.status(500).json({ error: error.message });
  }
});

// ORDER ROUTES (HTTP fallback + WebSocket integration)

// Get all orders (REST API)
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get orders by status
app.get("/api/orders/status/:status", async (req, res) => {
  try {
    const { status } = req.params;
    const orders = await prisma.order.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create order via HTTP (fallback if WebSocket not used)
app.post("/api/orders", async (req, res) => {
  try {
    const { tableNumber, items, createdBy } = req.body;

    const order = await prisma.order.create({
      data: {
        tableNumber: parseInt(tableNumber),
        items,
        status: "PENDING",
        createdBy: createdBy || "anonymous",
      },
    });

    // Also broadcast via WebSocket
    // This requires access to wsManager - we'd need to import it
    // For now, just return the order

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update order status via HTTP
app.put("/api/orders/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = await prisma.order.update({
      where: { id: parseInt(id) },
      data: { status },
    });

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WEBSOCKET INFO & STATUS

app.get("/api/ws-stats", (req, res) => {
  res.json(wsManager.getStats());
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket ready at ws://localhost:${PORT}`);
  console.log(`📊 WebSocket stats: http://localhost:${PORT}/api/ws-stats`);
});
