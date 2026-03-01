import React from "react";

function Navigation({ currentPage, setCurrentPage }) {
  return (
    <nav className="bg-gray-800 text-white p-4 mb-6">
      <div className="max-w-4xl mx-auto flex gap-4">
        <button
          onClick={() => setCurrentPage("push")}
          className={`px-4 py-2 rounded transition-colors ${
            currentPage === "push" ? "bg-blue-600" : "hover:bg-gray-700"
          }`}
        >
          📱 Push Notifications
        </button>
        <button
          onClick={() => setCurrentPage("orders")}
          className={`px-4 py-2 rounded transition-colors ${
            currentPage === "orders" ? "bg-blue-600" : "hover:bg-gray-700"
          }`}
        >
          🍽️ Real-Time Orders
        </button>
      </div>
    </nav>
  );
}

export default Navigation;
