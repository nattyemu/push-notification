import express from "express";
import cors from "cors";
import prisma from "../utils/prisma.js";
import webpush from "web-push";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Setup VAPID keys
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Push Notification API" });
});

app.post("/api/subscribe/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const { endpoint, keys } = req.body;

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { email: email },
      });
    }

    // Save subscription
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

// Get user's subscriptions
app.get("/api/subscriptions/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const user = await prisma.user.findUnique({
      where: { email: email },
      include: { subscriptions: true },
    });

    res.json(user?.subscriptions || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/send/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const { title, body } = req.body;

    // Get user with subscriptions
    const user = await prisma.user.findUnique({
      where: { email: email },
      include: { subscriptions: true },
    });

    if (!user || user.subscriptions.length === 0) {
      return res.status(404).json({ error: "No subscriptions found" });
    }

    const payload = JSON.stringify({
      title: title || "New Notification",
      body: body || "You have a new message",
      icon: "/icon.png",
    });

    // Send to all user's devices
    const results = await Promise.allSettled(
      user.subscriptions.map((sub) => {
        const subscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
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

// Get public key for frontend
app.get("/api/vapid-public-key", (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
