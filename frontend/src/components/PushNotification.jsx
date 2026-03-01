import React, { useState, useEffect } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

function PushNotification() {
  const [permission, setPermission] = useState(Notification.permission);
  const [publicKey, setPublicKey] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // Get VAPID public key
  useEffect(() => {
    const fetchPublicKey = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/api/vapid-public-key`);
        setPublicKey(data.publicKey);
      } catch (error) {
        setStatus("❌ Failed to get public key");
      }
    };
    fetchPublicKey();
  }, []);

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("✅ SW registered"))
        .catch((err) => console.error("SW failed:", err));
    }
  }, []);

  const askPermission = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
    setStatus(
      result === "granted" ? "✅ Permission granted" : "❌ Permission denied",
    );
  };

  const subscribe = async () => {
    if (!email) {
      setStatus("❌ Enter email");
      return;
    }
    if (permission !== "granted") {
      setStatus("❌ Allow notifications first");
      return;
    }

    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      });

      await axios.post(`${API_URL}/api/subscribe/${email}`, subscription);
      setStatus("✅ Subscribed!");
    } catch (error) {
      setStatus("❌ Subscribe failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const sendTest = async () => {
    if (!email) {
      setStatus("❌ Enter email");
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/send/${email}`, {
        title: "Test Notification",
        body: message || "Hello from push demo!",
      });
      setStatus(`✅ Sent to ${data.sent} device(s)`);
    } catch (error) {
      setStatus("❌ Send failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6">📱 Push Notifications</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-lg p-2"
              placeholder="your@email.com"
            />
          </div>

          <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
            <span>Permission:</span>
            <span
              className={`font-semibold ${
                permission === "granted" ? "text-green-600" : "text-red-600"
              }`}
            >
              {permission}
            </span>
          </div>

          {permission !== "granted" && (
            <button
              onClick={askPermission}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              🔔 Allow Notifications
            </button>
          )}

          <button
            onClick={subscribe}
            disabled={loading || permission !== "granted" || !email}
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Subscribing..." : "✅ Subscribe"}
          </button>

          <div>
            <label className="block text-sm font-medium mb-1">
              Test Message
            </label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full border rounded-lg p-2"
              placeholder="Enter test message"
            />
          </div>

          <button
            onClick={sendTest}
            disabled={loading}
            className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? "Sending..." : "📨 Send Test"}
          </button>

          {status && (
            <div className="p-3 bg-blue-50 text-blue-700 rounded">{status}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PushNotification;
