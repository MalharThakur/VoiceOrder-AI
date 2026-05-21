import { getDb } from './database';

export interface Product {
  id: number;
  name: string;
  price: number;
  sku?: string | null;
}

export interface Customer {
  id: number;
  name: string;
  code?: string | null;
  contact_info?: string | null;
}

export interface Order {
  id: number;
  customer_id: number | null;
  total_amount: number;
  status: string;
  created_at: number;
  ai_cost: number;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  price: number;
}

export interface OrderWithCustomer extends Order {
  customer_name: string | null;
  customer_code: string | null;
}

// Product DAO
export const getAllProducts = async (): Promise<Product[]> => {
  const db = await getDb();
  return await db.getAllAsync<Product>('SELECT * FROM products ORDER BY name ASC');
};

export const insertProduct = async (name: string, price: number, sku?: string) => {
  const db = await getDb();
  const result = await db.runAsync('INSERT INTO products (name, price, sku) VALUES (?, ?, ?)', [name, price, sku || null]);
  return result.lastInsertRowId;
};

// Customer DAO
export const getAllCustomers = async (): Promise<Customer[]> => {
  const db = await getDb();
  return await db.getAllAsync<Customer>('SELECT * FROM customers ORDER BY name ASC');
};

export const insertCustomer = async (name: string, code?: string, contact_info?: string) => {
  const db = await getDb();
  const result = await db.runAsync('INSERT INTO customers (name, code, contact_info) VALUES (?, ?, ?)', [name, code || null, contact_info || null]);
  return result.lastInsertRowId;
};

// Order DAO
export const getAllOrdersWithCustomer = async (): Promise<OrderWithCustomer[]> => {
  const db = await getDb();
  return await db.getAllAsync<OrderWithCustomer>(`
    SELECT o.id, o.customer_id, o.total_amount, o.status, o.created_at, o.ai_cost,
           c.name as customer_name, c.code as customer_code
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    ORDER BY o.created_at DESC
  `);
};

export const insertOrder = async (order: Omit<Order, 'id'>, items: Omit<OrderItem, 'id' | 'order_id'>[]) => {
  const db = await getDb();

  // Use a transaction
  let orderId = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      'INSERT INTO orders (customer_id, total_amount, status, created_at, ai_cost) VALUES (?, ?, ?, ?, ?)',
      [order.customer_id, order.total_amount, order.status, order.created_at, order.ai_cost]
    );
    orderId = result.lastInsertRowId;

    for (const item of items) {
      await db.runAsync(
        'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)',
        [orderId, item.product_id, item.product_name, item.quantity, item.price]
      );
    }
  });
  return orderId;
};

export const getItemsForOrder = async (orderId: number): Promise<OrderItem[]> => {
  const db = await getDb();
  return await db.getAllAsync<OrderItem>('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
};

export { initDb } from './database';

// Helper for initial mock data
export const seedMockDataIfNeeded = async () => {
    const db = await getDb();
    const productsCountResult = await db.getFirstAsync<{count: number}>('SELECT COUNT(*) as count FROM products');
    if (productsCountResult && productsCountResult.count === 0) {
        await insertProduct("Laptop", 999.99, "TECH-001");
        await insertProduct("Mouse", 25.50, "TECH-002");
        await insertProduct("Keyboard", 45.00, "TECH-003");
        await insertProduct("Monitor", 199.99, "TECH-004");
    }

    const customersCountResult = await db.getFirstAsync<{count: number}>('SELECT COUNT(*) as count FROM customers');
    if (customersCountResult && customersCountResult.count === 0) {
        await insertCustomer("Acme Corp", "C-001");
        await insertCustomer("Global Tech", "C-002");
    }
}
