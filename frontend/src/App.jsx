import React, { useState } from "react";
import PushNotification from "./components/PushNotification";
import OrderSystemSimple from "./components/OrderSystemSimple";
import Navigation from "./components/Navigation";

function App() {
  const [currentPage, setCurrentPage] = useState("push");

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <div className="container mx-auto">
        {currentPage === "push" ? <PushNotification /> : <OrderSystemSimple />}
      </div>
    </div>
  );
}

export default App;
