import React, { useState } from "react";

import LoginScreen from "./src/screens/LoginScreen";
import PrinterScreen from "./src/screens/PrinterScreen";

import type {
  AuthUser,
  Restaurant,
} from "./src/types/auth";

function App() {
  const [session, setSession] = useState<{
    token: string;
    user: AuthUser;
    restaurant: Restaurant;
  } | null>(null);

  const handleLogin = (
    token: string,
    user: AuthUser,
    restaurant: Restaurant
  ) => {
    setSession({
      token,
      user,
      restaurant,
    });
  };

  if (!session) {
    return (
      <LoginScreen
        onLogin={handleLogin}
      />
    );
  }

  return (
    <PrinterScreen
      userName={session.user.name}
      restaurantName={session.restaurant.name}
      restaurantId={session.user.restaurantId}
      userRole={session.user.role}
    />
  );
}

export default App;