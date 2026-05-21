import { create } from 'zustand';
import * as daos from '../db/daos';
import { initDb } from '../db/database';
import { Product, Customer, OrderWithCustomer } from '../db/daos';

interface VoiceOrderState {
  products: Product[];
  customers: Customer[];
  orders: OrderWithCustomer[];

  isRecording: boolean;
  isProcessing: boolean;
  errorMessage: string | null;
  successMessage: string | null;

  detectedOrder: ActiveOrderState | null;

  // Auth State
  userRole: string | null;
  userName: string | null;

  // Actions
  fetchData: () => Promise<void>;
  setIsRecording: (isRecording: boolean) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setErrorMessage: (msg: string | null) => void;
  setSuccessMessage: (msg: string | null) => void;
  setDetectedOrder: (order: ActiveOrderState | null) => void;

  setAuthUser: (role: string | null, name: string | null) => void;

  // Modifying active order
  updateDetectedItemQuantity: (index: number, quantity: number) => void;
  updateDetectedItemProduct: (index: number, product: Product) => void;
  removeDetectedItem: (index: number) => void;
  addDetectedItem: () => void;
  cancelDetectedOrder: () => void;
  confirmAndPlaceOrder: () => Promise<void>;
}

export interface ActiveOrderState {
  customer: Customer | null;
  items: ActiveOrderItem[];
  aiCost: number;
  originalTranscript?: string | null;
}

export interface ActiveOrderItem {
  product: Product;
  quantity: number;
  suggestions: Product[];
}

export const useStore = create<VoiceOrderState>((set, get) => ({
  products: [],
  customers: [],
  orders: [],

  isRecording: false,
  isProcessing: false,
  errorMessage: null,
  successMessage: null,

  detectedOrder: null,

  userRole: null,
  userName: null,

  fetchData: async () => {
    try {
      await initDb();
      await daos.seedMockDataIfNeeded();

      const [products, customers, orders] = await Promise.all([
        daos.getAllProducts(),
        daos.getAllCustomers(),
        daos.getAllOrdersWithCustomer()
      ]);

      set({ products, customers, orders });
    } catch (e) {
      console.error("Failed to fetch DB data", e);
    }
  },

  setIsRecording: (isRecording) => set({ isRecording }),
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  setSuccessMessage: (successMessage) => set({ successMessage }),
  setDetectedOrder: (detectedOrder) => set({ detectedOrder }),

  setAuthUser: (userRole, userName) => set({ userRole, userName }),

  updateDetectedItemQuantity: (index, quantity) => {
    const { detectedOrder } = get();
    if (!detectedOrder) return;

    const newItems = [...detectedOrder.items];
    if (newItems[index]) {
      newItems[index] = { ...newItems[index], quantity: Math.max(1, quantity) };
      set({ detectedOrder: { ...detectedOrder, items: newItems } });
    }
  },

  updateDetectedItemProduct: (index, product) => {
    const { detectedOrder } = get();
    if (!detectedOrder) return;

    const newItems = [...detectedOrder.items];
    if (newItems[index]) {
      newItems[index] = { ...newItems[index], product };
      set({ detectedOrder: { ...detectedOrder, items: newItems } });
    }
  },

  removeDetectedItem: (index) => {
    const { detectedOrder } = get();
    if (!detectedOrder) return;

    const newItems = detectedOrder.items.filter((_, i) => i !== index);
    set({ detectedOrder: { ...detectedOrder, items: newItems } });
  },

  addDetectedItem: () => {
    const { detectedOrder, products } = get();
    if (!detectedOrder || products.length === 0) return;

    const newItems = [
      ...detectedOrder.items,
      { product: products[0], quantity: 1, suggestions: [] }
    ];
    set({ detectedOrder: { ...detectedOrder, items: newItems } });
  },

  cancelDetectedOrder: () => set({ detectedOrder: null }),

  confirmAndPlaceOrder: async () => {
    const { detectedOrder } = get();
    if (!detectedOrder || !detectedOrder.customer || detectedOrder.items.length === 0) return;

    try {
      const totalAmount = detectedOrder.items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

      await daos.insertOrder({
        customer_id: detectedOrder.customer.id,
        total_amount: totalAmount,
        status: "CONFIRMED",
        created_at: Date.now(),
        ai_cost: detectedOrder.aiCost
      }, detectedOrder.items.map(item => ({
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        price: item.product.price
      })));

      set({ detectedOrder: null, successMessage: "Order placed successfully!" });
      get().fetchData(); // Refresh orders
    } catch (error) {
      console.error(error);
      set({ errorMessage: "Failed to place order." });
    }
  }
}));
