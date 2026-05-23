import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initDb, database, Customer, Product, OrderWithCustomer } from './src/database/db';
import { COLORS, SPACING } from './src/theme';
import { Badge } from './src/components/Badge';
import { DetectedOrderConfirmationCard, ActiveOrderState } from './src/components/DetectedOrderConfirmationCard';
import { VoiceEntryScreen } from './src/screens/VoiceEntryScreen';
import { CatalogScreen } from './src/screens/CatalogScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { Database, Mic, List, History, Play, LogOut } from 'lucide-react-native';

const AppContent = () => {
  const [dbReady, setDbReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'voice' | 'catalogs' | 'history'>('voice');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<OrderWithCustomer[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedOrder, setDetectedOrder] = useState<ActiveOrderState | null>(null);

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Load database and sync state list
  const syncStateList = async () => {
    try {
      const pList = await database.getProducts();
      const cList = await database.getCustomers();
      const oList = await database.getOrdersWithCustomer();
      setProducts(pList);
      setCustomers(cList);
      setOrders(oList);
    } catch (err) {
      console.error('Error fetching initial database elements', err);
    }
  };

  useEffect(() => {
    const setup = async () => {
      // 1. Check local session token
      try {
        const storedToken = await AsyncStorage.getItem('auth_token');
        setAuthToken(storedToken);
      } catch (err) {
        console.error('Auth session fetch failed:', err);
      } finally {
        setCheckingSession(false);
      }

      // 2. Setup database
      await initDb();
      setDbReady(true);
      await syncStateList();
    };
    setup();
  }, []);

  // Place transaction confirmed order
  const handleConfirmOrder = async (finalOrder: ActiveOrderState) => {
    try {
      const totalAmount = finalOrder.items.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
      );

      // Create orders mapping logs
      await database.createOrderTransaction(
        {
          customer_id: finalOrder.customer ? finalOrder.customer.id! : null,
          total_amount: totalAmount,
          status: 'completed',
          created_at: Date.now(),
          ai_cost: finalOrder.aiCost,
        },
        finalOrder.items.map((item) => ({
          product_id: item.product.id!,
          quantity: item.quantity,
          price: item.product.price,
        }))
      );

      setDetectedOrder(null);
      await syncStateList();
      alert('Order Placed Successfully!');
    } catch (err) {
      alert('Failed to save order in SQLite: ' + err);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('auth_token');
      setAuthToken(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (checkingSession || !dbReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.emeraldPrimary} />
        <Text style={styles.loadingText}>Initializing App & Session...</Text>
      </View>
    );
  }

  if (!authToken) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        <LoginScreen onLoginSuccess={(token) => setAuthToken(token)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Top Banner Header */}
      <View style={styles.appHeader}>
        <View style={styles.headerTitleContainer}>
          <View style={styles.logoMic}>
            <Play size={18} color={COLORS.white} />
          </View>
          <Text style={styles.headerText}>VoiceOrder AI</Text>
        </View>

        {/* Counter items displays and logout */}
        <View style={styles.badgeRow}>
          <Badge
            icon={<Database size={10} color="#71717A" />}
            label={`${products.length} Products`}
          />
          <View style={{ width: 6 }} />
          <Badge
            icon={<History size={10} color="#71717A" />}
            label={`${customers.length} Customers`}
          />
          <View style={{ width: 10 }} />
          <TouchableOpacity
            onPress={handleLogout}
            style={styles.logoutIconButton}
            activeOpacity={0.7}
          >
            <LogOut size={16} color={COLORS.red500} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Page Area */}
      <View style={styles.contentBody}>
        {activeTab === 'voice' && (
          <VoiceEntryScreen
            products={products}
            customers={customers}
            isProcessing={isProcessing}
            setIsProcessing={setIsProcessing}
            setDetectedOrder={setDetectedOrder}
            onRefresh={syncStateList}
          />
        )}
        {activeTab === 'catalogs' && (
          <CatalogScreen
            products={products}
            customers={customers}
            onRefresh={syncStateList}
          />
        )}
        {activeTab === 'history' && <HistoryScreen orders={orders} />}
      </View>

      {/* Bottom Nav Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('voice')}
        >
          <Mic
            size={22}
            color={activeTab === 'voice' ? COLORS.emeraldPrimary : COLORS.zinc400}
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'voice' && styles.navLabelActive,
            ]}
          >
            Voice Entry
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('catalogs')}
        >
          <List
            size={22}
            color={activeTab === 'catalogs' ? COLORS.emeraldPrimary : COLORS.zinc400}
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'catalogs' && styles.navLabelActive,
            ]}
          >
            Catalog Files
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('history')}
        >
          <History
            size={22}
            color={activeTab === 'history' ? COLORS.emeraldPrimary : COLORS.zinc400}
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'history' && styles.navLabelActive,
            ]}
          >
            App Orders
          </Text>
        </TouchableOpacity>
      </View>

      {/* Structured Confirmation Editor Dialog Drawer Overlay */}
      {detectedOrder && (
        <DetectedOrderConfirmationCard
          visible={detectedOrder !== null}
          activeOrder={detectedOrder}
          allProducts={products}
          allCustomers={customers}
          onConfirm={handleConfirmOrder}
          onCancel={() => setDetectedOrder(null)}
        />
      )}
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.lightZincBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.darkZinc,
  },
  safeContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.zinc200,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoMic: {
    width: 32,
    height: 32,
    backgroundColor: COLORS.emeraldPrimary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.darkZinc,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutIconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.zinc200,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentBody: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    height: 64,
    borderTopWidth: 1,
    borderTopColor: COLORS.zinc200,
    backgroundColor: COLORS.white,
    paddingBottom: 8,
    paddingTop: 8,
  },
  navItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navLabel: {
    fontSize: 10,
    color: COLORS.zinc400,
    marginTop: 4,
  },
  navLabelActive: {
    color: COLORS.emeraldPrimary,
    fontWeight: '700',
  },
});
