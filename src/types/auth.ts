export type UserRole = "admin" | "staff";

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  restaurantId: string;
}

export interface Restaurant {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  restaurant: Restaurant;
}