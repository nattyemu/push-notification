import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;
const WS_URL = import.meta.env.WS_URL || "ws://localhost:3000";

function OrderSystemSimple() {
  const [role, setRole] = useState("waiter");
  const [connected, setConnected] = useState(false);
  const [orders, setOrders] = useState([]);
  const [tableNumber, setTableNumber] = useState("");
  const [items, setItems] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const wsRef = useRef(null);

  // Load orders on mount
  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/orders`);
      filterOrdersByRole(data);
    } catch (err) {
      console.error("Failed to load orders:", err);
    }
  };

  const filterOrdersByRole = (allOrders) => {
    if (role === "chef") {
      setOrders(
        allOrders.filter((o) => ["PENDING", "PREPARING"].includes(o.status)),
      );
    } else {
      setOrders(allOrders.filter((o) => o.status !== "DELIVERED"));
    }
  };

  // WebSocket connection
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [role]);

  const connectWebSocket = () => {
    // Connect with role only - no email
    wsRef.current = new WebSocket(`${WS_URL}?role=${role}`);

    wsRef.current.onopen = () => {
      setConnected(true);
      setStatusMsg(`✅ Connected as ${role}`);
    };

    wsRef.current.onmessage = (e) => {
      const data = JSON.parse(e.data);
      handleWebSocketMessage(data);
    };

    wsRef.current.onclose = () => {
      setConnected(false);
      setStatusMsg("🔴 Disconnected - reconnecting...");
      setTimeout(connectWebSocket, 3000);
    };

    wsRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  };

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case "initial_orders":
        filterOrdersByRole(data.data);
        setStatusMsg(`📋 Loaded ${data.data.length} orders`);
        break;

      case "new_order":
        setOrders((prev) => [data.data, ...prev]);
        if (role === "chef") {
          setStatusMsg(
            `🔔 New order #${data.data.id} from Table ${data.data.tableNumber}`,
          );
          new Audio("/notification.mp3").play().catch(() => {});
        }
        break;

      case "status_update":
        setOrders((prev) =>
          prev.map((o) =>
            o.id === data.data.orderId ? { ...o, status: data.data.status } : o,
          ),
        );
        setStatusMsg(
          `🔄 Order #${data.data.orderId} is now ${data.data.status}`,
        );
        break;

      case "order_confirmation":
        setStatusMsg(`✅ ${data.message}`);
        break;

      case "error":
        setStatusMsg(`❌ ${data.message}`);
        break;
    }
  };

  const sendOrder = () => {
    if (!connected) return setStatusMsg("❌ Not connected");
    if (!tableNumber) return setStatusMsg("❌ Enter table number");
    if (!items) return setStatusMsg("❌ Enter items");

    const orderData = {
      tableNumber: parseInt(tableNumber),
      items: items.split(",").map((i) => i.trim()),
    };

    wsRef.current.send(
      JSON.stringify({
        type: "new_order",
        order: orderData,
      }),
    );

    setTableNumber("");
    setItems("");
    setStatusMsg("📤 Order sent!");
  };

  const updateStatus = (orderId, newStatus) => {
    if (!connected) return setStatusMsg("❌ Not connected");

    wsRef.current.send(
      JSON.stringify({
        type: "update_status",
        orderId,
        status: newStatus,
      }),
    );
  };

  const getStatusStyle = (status) =>
    ({
      PENDING: "bg-yellow-100 border-yellow-300",
      PREPARING: "bg-blue-100 border-blue-300",
      READY: "bg-green-100 border-green-300",
      DELIVERED: "bg-gray-100 border-gray-300",
    })[status] || "bg-gray-100";

  const getStatusIcon = (status) =>
    ({
      PENDING: "⏳",
      PREPARING: "👨‍🍳",
      READY: "✅",
      DELIVERED: "🍽️",
    })[status] || "📋";

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">🍽️ Real-Time Order System</h2>
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-sm ${
                connected
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {connected ? "🟢 Connected" : "🔴 Disconnected"}
            </span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="border rounded-lg p-2 bg-white"
            >
              <option value="waiter">👨‍💼 Waiter</option>
              <option value="chef">👨‍🍳 Chef</option>
            </select>
          </div>
        </div>

        {statusMsg && (
          <div className="p-3 bg-blue-50 text-blue-700 rounded-lg">
            {statusMsg}
          </div>
        )}
      </div>

      {/* Waiter Form */}
      {role === "waiter" && (
        <div className="bg-white rounded-lg shadow p-4 mb-4 border border-gray-200">
          <h3 className="font-bold mb-3 text-lg">📝 New Order</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              type="number"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="border rounded-lg p-2"
              placeholder="Table #"
              min="1"
            />
            <input
              type="text"
              value={items}
              onChange={(e) => setItems(e.target.value)}
              className="border rounded-lg p-2"
              placeholder="Pasta, Salad"
            />
          </div>
          <button
            onClick={sendOrder}
            disabled={!connected || !tableNumber || !items}
            className="w-full bg-green-600 text-white p-3 rounded-lg disabled:opacity-50"
          >
            🚀 Send to Kitchen
          </button>
        </div>
      )}

      {/* Orders List */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <span>{role === "chef" ? "👨‍🍳" : "📋"}</span>
          {role === "chef" ? "Kitchen Orders" : "Active Orders"}
          <span className="text-sm bg-gray-100 px-2 py-1 rounded-full ml-2">
            {orders.length}
          </span>
        </h3>

        {orders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-3">🍽️</div>
            <p>No orders</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className={`border-2 rounded-lg p-4 ${getStatusStyle(order.status)}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">
                        {getStatusIcon(order.status)}
                      </span>
                      <span className="font-bold">Order #{order.id}</span>
                      <span className="bg-white px-2 py-0.5 rounded text-sm">
                        Table {order.tableNumber}
                      </span>
                    </div>
                    <div className="mt-2">Items: {order.items.join(", ")}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {new Date(order.createdAt).toLocaleTimeString()}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {role === "chef" && order.status === "PENDING" && (
                      <button
                        onClick={() => updateStatus(order.id, "PREPARING")}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                      >
                        Start
                      </button>
                    )}
                    {role === "chef" && order.status === "PREPARING" && (
                      <button
                        onClick={() => updateStatus(order.id, "READY")}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                      >
                        Ready
                      </button>
                    )}
                    {role === "waiter" && order.status === "READY" && (
                      <button
                        onClick={() => updateStatus(order.id, "DELIVERED")}
                        className="bg-purple-600 text-white px-3 py-1 rounded text-sm"
                      >
                        Deliver
                      </button>
                    )}
                    <span className="px-2 py-1 rounded text-sm font-bold bg-white">
                      {order.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default OrderSystemSimple;
