import { io, Socket } from "socket.io-client";

const API_URL =
  "https://dineflow-050e.onrender.com";

export const socket: Socket = io(API_URL, {
  autoConnect: false,
  transports: ["websocket"],
});

export function connectSocket(
  restaurantId: string
) {
  if (!restaurantId) {
    throw new Error(
      "Restaurant ID is required"
    );
  }

  const joinRestaurant = () => {
    console.log(
      "🏪 Joining restaurant:",
      restaurantId
    );

    socket.emit(
      "join-restaurant",
      restaurantId
    );
  };

  if (socket.connected) {
    joinRestaurant();
    return;
  }

  socket.once(
    "connect",
    joinRestaurant
  );

  socket.connect();
}

export function disconnectSocket() {
  if (socket.connected) {
    socket.disconnect();
  }
}