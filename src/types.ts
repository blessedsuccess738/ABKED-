export interface User {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'STAFF';
}

export interface Product {
  id: number;
  name: string;
  category: string;
  cost_price: number;
  selling_price: number;
  quantity: number;
  low_stock_threshold: number;
}

export interface CartItem {
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface Sale {
  id: number;
  invoice_number: string;
  customer_name: string;
  customer_phone?: string;
  total_amount: number;
  payment_method: 'CASH' | 'TRANSFER' | 'POS';
  created_at: string;
  staff_name?: string;
}

export interface SaleItem {
  id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}
