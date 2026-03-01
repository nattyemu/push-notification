import { WebSocketServer } from "ws";
import prisma from "./utils/prisma.js";

class WebSocketManager {
  constructor(server) {
    this.wss = new WebSocketServer({ server });
    this.connections = {
      waiters: new Set(),
      chefs: new Set(),
    };

    this.initialize();
    // console.log("🔌 WebSocket Manager initialized");
  }

  initialize() {
    this.wss.on("connection", async (ws, req) => {
      const urlParams = new URLSearchParams(req.url.split("?")[1]);
      const role = urlParams.get("role");

      // console.log(`📱 ${role} connected`);

      // Store connection by role only
      if (role === "waiter") {
        this.connections.waiters.add(ws);
      } else if (role === "chef") {
        this.connections.chefs.add(ws);
      }

      // Send initial data
      await this.sendInitialData(ws, role);

      ws.on("message", async (message) => {
        await this.handleMessage(ws, message);
      });

      ws.on("close", () => {
        if (role === "waiter") {
          this.connections.waiters.delete(ws);
        } else if (role === "chef") {
          this.connections.chefs.delete(ws);
        }
        // console.log(`❌ ${role} disconnected`);
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
      });
    });
  }

  async sendInitialData(ws, role) {
    try {
      const orders = await prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        include: { user: true },
      });

      if (role === "chef") {
        // Chefs see pending and preparing orders
        const chefOrders = orders.filter((o) =>
          ["PENDING", "PREPARING"].includes(o.status),
        );
        ws.send(JSON.stringify({ type: "initial_orders", data: chefOrders }));
      } else {
        // Waiters see all non-delivered orders
        const waiterOrders = orders.filter((o) => o.status !== "DELIVERED");
        ws.send(JSON.stringify({ type: "initial_orders", data: waiterOrders }));
      }
    } catch (error) {
      console.error("Error sending initial data:", error);
    }
  }

  async handleMessage(ws, message) {
    try {
      const data = JSON.parse(message);
      // console.log(`📨 Message:`, data.type);

      switch (data.type) {
        case "new_order":
          await this.handleNewOrder(ws, data.order);
          break;
        case "update_status":
          await this.handleStatusUpdate(ws, data.orderId, data.status);
          break;
        default:
        // console.log("Unknown message type:", data.type);
      }
    } catch (error) {
      console.error("Error handling message:", error);
    }
  }

  async handleNewOrder(ws, orderData) {
    try {
      // Save to database with demo user
      const demoUser = await prisma.user.upsert({
        where: { email: "demo@restaurant.com" },
        update: {},
        create: { email: "demo@restaurant.com" },
      });

      const order = await prisma.order.create({
        data: {
          tableNumber: parseInt(orderData.tableNumber),
          items: orderData.items,
          status: "PENDING",
          user: { connect: { id: demoUser.id } },
        },
        include: { user: true },
      });

      // console.log(`✅ Order #${order.id} created`);

      // Broadcast to ALL chefs
      const message = JSON.stringify({
        type: "new_order",
        data: order,
      });

      this.connections.chefs.forEach((chef) => {
        if (chef.readyState === 1) chef.send(message);
      });

      // Confirm to waiter
      ws.send(
        JSON.stringify({
          type: "order_confirmation",
          message: `Order #${order.id} sent to kitchen`,
        }),
      );
    } catch (error) {
      console.error("❌ Error creating order:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Failed to create order",
        }),
      );
    }
  }

  async handleStatusUpdate(ws, orderId, newStatus) {
    try {
      const order = await prisma.order.update({
        where: { id: parseInt(orderId) },
        data: { status: newStatus },
        include: { user: true },
      });

      // console.log(`✅ Order #${orderId} status: ${newStatus}`);

      // Broadcast to ALL waiters
      const message = JSON.stringify({
        type: "status_update",
        data: { orderId: order.id, status: order.status, order },
      });

      this.connections.waiters.forEach((waiter) => {
        if (waiter.readyState === 1) waiter.send(message);
      });

      // Also send to chefs to update their view
      this.connections.chefs.forEach((chef) => {
        if (chef.readyState === 1) chef.send(message);
      });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  }

  getStats() {
    return {
      waiters: this.connections.waiters.size,
      chefs: this.connections.chefs.size,
    };
  }
}

export default WebSocketManager;
