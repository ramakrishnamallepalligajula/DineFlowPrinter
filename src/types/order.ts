export interface OrderItem {
  id: string;
  name: string;
  price: number;
  category?: string;
  quantity: number;
}

export interface DineFlowOrder {
  _id: string;
  orderId: number;
  restaurantId: string;
  tableId: string;
  tableNumber: number;
  items: OrderItem[];
  totalItems: number;
  totalPrice: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}