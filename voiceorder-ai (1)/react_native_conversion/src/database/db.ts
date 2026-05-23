import * as SQLite from 'expo-sqlite';

export interface Customer {
  id?: number;
  name: string;
  email?: string;
  phone?: string;
  code?: string;
}

export interface Product {
  id?: number;
  name: string;
  price: number;
  sku?: string;
}

export interface Order {
  id?: number;
  customer_id: number | null;
  total_amount: number;
  status: string;
  created_at: number;
  ai_cost: number;
}

export interface OrderItem {
  id?: number;
  order_id: number;
  product_id: number | null;
  quantity: number;
  price: number;
}

export interface OrderWithCustomer {
  id: number;
  customer_id: number | null;
  total_amount: number;
  status: string;
  created_at: number;
  ai_cost: number;
  customer_name: string | null;
  customer_code: string | null;
}

let dbInstance: any = null;

export const initDb = async () => {
  try {
    const db = await SQLite.openDatabaseAsync('voiceorder.db');
    dbInstance = db;

    // Create table structures
    await db.execAsync(`
      PRAGMA foreign_keys = ON;
      
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        code TEXT
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        sku TEXT
      );

      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        total_amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'completed',
        created_at INTEGER NOT NULL,
        ai_cost REAL NOT NULL DEFAULT 0.0,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
      );
    `);
    console.log('VoiceOrder database initialized successfully!');
    return db;
  } catch (err) {
    console.error('Error initializing SQLite db, falling back to in-memory store', err);
    return null;
  }
};

// In-Memory fallback DB mock system if native SQLite is unavailable (e.g. expo web/Go testing)
class InMemoryDb {
  customers: Customer[] = [];
  products: Product[] = [];
  orders: Order[] = [];
  orderItems: OrderItem[] = [];
  private lastId = { customers: 0, products: 0, orders: 0, orderItems: 0 };

  async getProducts(): Promise<Product[]> {
    return this.products;
  }

  async insertProducts(list: Product[]) {
    list.forEach(p => {
      this.lastId.products++;
      this.products.push({ ...p, id: this.lastId.products });
    });
  }

  async getCustomers(): Promise<Customer[]> {
    return this.customers;
  }

  async insertCustomers(list: Customer[]) {
    list.forEach(c => {
      this.lastId.customers++;
      this.customers.push({ ...c, id: this.lastId.customers });
    });
  }

  async getOrders(): Promise<OrderWithCustomer[]> {
    return this.orders.map(o => {
      const cust = this.customers.find(c => c.id === o.customer_id);
      return {
        ...o,
        id: o.id!,
        customer_name: cust ? cust.name : 'Unknown Customer',
        customer_code: cust && cust.code ? cust.code : null
      };
    }).sort((a, b) => b.created_at - a.created_at);
  }

  async createOrder(order: Omit<Order, 'id'>, items: Omit<OrderItem, 'id' | 'order_id'>[]) {
    this.lastId.orders++;
    const newOrderId = this.lastId.orders;
    
    const newOrder: Order = { ...order, id: newOrderId };
    this.orders.push(newOrder);

    items.forEach(itm => {
      this.lastId.orderItems++;
      this.orderItems.push({
        ...itm,
        id: this.lastId.orderItems,
        order_id: newOrderId
      });
    });
  }

  async clearAll() {
    this.customers = [];
    this.products = [];
    this.orders = [];
    this.orderItems = [];
    this.lastId = { customers: 0, products: 0, orders: 0, orderItems: 0 };
  }
}

const memoryDb = new InMemoryDb();

export const database = {
  getProducts: async (): Promise<Product[]> => {
    if (!dbInstance) return memoryDb.getProducts();
    try {
      return await dbInstance.getAllAsync('SELECT * FROM products ORDER BY name ASC');
    } catch (e) {
      return memoryDb.getProducts();
    }
  },

  insertProductsBulk: async (products: Product[]) => {
    if (!dbInstance) return memoryDb.insertProducts(products);
    try {
      for (const p of products) {
        await dbInstance.runAsync(
          'INSERT INTO products (name, price, sku) VALUES (?, ?, ?)',
          [p.name, p.price, p.sku || '']
        );
      }
    } catch (e) {
      await memoryDb.insertProducts(products);
    }
  },

  getCustomers: async (): Promise<Customer[]> => {
    if (!dbInstance) return memoryDb.getCustomers();
    try {
      return await dbInstance.getAllAsync('SELECT * FROM customers ORDER BY name ASC');
    } catch (e) {
      return memoryDb.getCustomers();
    }
  },

  insertCustomersBulk: async (customers: Customer[]) => {
    if (!dbInstance) return memoryDb.insertCustomers(customers);
    try {
      for (const c of customers) {
        await dbInstance.runAsync(
          'INSERT INTO customers (name, email, phone, code) VALUES (?, ?, ?, ?)',
          [c.name, c.email || '', c.phone || '', c.code || '']
        );
      }
    } catch (e) {
      await memoryDb.insertCustomers(customers);
    }
  },

  getOrdersWithCustomer: async (): Promise<OrderWithCustomer[]> => {
    if (!dbInstance) return memoryDb.getOrders();
    try {
      const q = `
        SELECT o.id, o.customer_id, o.total_amount, o.status, o.created_at, o.ai_cost, 
               c.name as customer_name, c.code as customer_code 
        FROM orders o 
        LEFT JOIN customers c ON o.customer_id = c.id 
        ORDER BY o.created_at DESC
      `;
      return await dbInstance.getAllAsync(q);
    } catch (e) {
      return memoryDb.getOrders();
    }
  },

  createOrderTransaction: async (order: Omit<Order, 'id'>, items: Omit<OrderItem, 'id' | 'order_id'>[]) => {
    if (!dbInstance) return memoryDb.createOrder(order, items);
    try {
      // Direct insertion running in sequential step
      const result = await dbInstance.runAsync(
        'INSERT INTO orders (customer_id, total_amount, status, created_at, ai_cost) VALUES (?, ?, ?, ?, ?)',
        [order.customer_id, order.total_amount, order.status, order.created_at, order.ai_cost]
      );
      
      const orderId = result.lastInsertRowId;
      for (const item of items) {
        await dbInstance.runAsync(
          'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
          [orderId, item.product_id, item.quantity, item.price]
        );
      }
    } catch (e) {
      console.error('Error saving order, writing to memory', e);
      await memoryDb.createOrder(order, items);
    }
  },

  clearAllData: async () => {
    if (!dbInstance) return memoryDb.clearAll();
    try {
      await dbInstance.runAsync('DELETE FROM order_items');
      await dbInstance.runAsync('DELETE FROM orders');
      await dbInstance.runAsync('DELETE FROM products');
      await dbInstance.runAsync('DELETE FROM customers');
    } catch (e) {
      await memoryDb.clearAll();
    }
  }
};
