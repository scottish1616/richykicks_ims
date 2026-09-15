// Shared TypeScript types mirroring the backend Pydantic schemas.
// Keep these in sync with backend/app/schemas/*.py as the API evolves.

export type UserRole = "admin" | "staff";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
}

export type StockStatus = "In Stock" | "Out of Stock";

export interface ProductVariant {
  id: string;
  colour: string; // "" means not applicable (no colour breakdown)
  size: string; // "" means not applicable (no size breakdown)
  stock_quantity: number;
}

export interface Product {
  id: string;
  name: string;
  category_id: string;
  listed_price: string;
  total_stock: number;
  stock_status: StockStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  variants: ProductVariant[];
}

export interface Sale {
  id: string;
  product_variant_id: string;
  staff_id: string;
  quantity: number;
  listed_price_at_sale: string;
  actual_price_paid: string;
  total_amount: string;
  created_at: string;
  product_name: string;
  colour: string;
  size: string;
}

// OPEN -> STAFF_COMPLETED -> CLOSED -> APPROVED / REJECTED.
// Staff's "Complete" is not approval - it just signals entry is done.
// Approve/Reject only ever become reachable once a session is CLOSED.
export type ReceivingSessionStatus =
  | "open"
  | "staff_completed"
  | "closed"
  | "approved"
  | "rejected";
export type ReceivingItemStatus = "pending" | "approved" | "rejected";

export interface ReceivingSession {
  id: string;
  opened_by: string;
  status: ReceivingSessionStatus;
  opened_at: string;
  completed_at: string | null;
  completed_by: string | null;
  closed_at: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  reopen_reason: string | null;
}

export interface ReceivingItem {
  id: string;
  session_id: string;
  product_id: string;
  product_variant_id: string | null;
  submitted_by: string;
  colour: string;
  size: string;
  quantity_submitted: number;
  price_submitted: string;
  quantity_approved: number | null;
  price_approved: string | null;
  status: ReceivingItemStatus;
  created_at: string;
}

export type NotificationType =
  | "receiving_completed"
  | "receiving_approved"
  | "receiving_rejected";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  receiving_session_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface DashboardSummary {
  total_products: number;
  in_stock: number;
  out_of_stock: number;
  todays_sales: string;
  this_month: string;
  last_month: string;
}

export interface StaffDashboardSummary {
  todays_sales: string;
  todays_items_sold: number;
  this_month_sales: string;
  this_month_items_sold: number;
}

export interface PeriodReport {
  period: string;
  start: string;
  end: string;
  revenue: string;
  quantity_sold: number;
  sale_count: number;
}

export interface ShopSettings {
  shop_name: string;
  address: string | null;
  phone: string | null;
  contact_email: string | null;
  updated_at: string;
}
