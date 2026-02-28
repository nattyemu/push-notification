import React, { useState, useEffect } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

const API_BASE_URL = `${API_URL}/api`;
function PushNotification() {
  const [permission, setPermission] = useState(Notification.permission);
  const [publicKey, setPublicKey] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // Get VAPID public key from backend
  useEffect(() => {
    const fetchPublicKey = async () => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/vapid-public-key`);
        setPublicKey(data.publicKey);
      } catch (error) {
        setStatus("Failed to get public key: " + error.message);
      }
    };
    fetchPublicKey();
  }, []);

  const askPermission = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  const subscribeUser = async () => {
    if (!email) {
      setStatus("Please enter email");
      return;
    }

    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      });

      // Save to backend using axios
      await axios.post(`${API_BASE_URL}/subscribe/${email}`, subscription);

      setStatus("Subscribed successfully!");
    } catch (error) {
      setStatus("Subscription failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const sendNotification = async () => {
    if (!email) {
      setStatus("Please enter email");
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/send/${email}`, {
        title: "Test Notification",
        body: message || "Hello from server!",
      });

      setStatus(`Sent to ${data.sent} device(s)`);
    } catch (error) {
      setStatus("Failed to send: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Push Notifications Demo</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="user@example.com"
            disabled={loading}
          />
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <span>Notification Permission:</span>
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
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Allow Notifications
          </button>
        )}

        {permission === "granted" && publicKey && (
          <button
            onClick={subscribeUser}
            disabled={loading || !email}
            className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Subscribing..." : "Subscribe"}
          </button>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Test Message</label>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Enter test message"
            disabled={loading}
          />
        </div>

        <button
          onClick={sendNotification}
          disabled={loading || !email}
          className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send Test Notification"}
        </button>

        {status && (
          <div className="p-3 bg-blue-50 text-blue-700 rounded-lg">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}

export default PushNotification;
