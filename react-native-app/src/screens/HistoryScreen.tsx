import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useStore } from '../store/useStore';
import { Package, User } from 'lucide-react-native';

export default function HistoryScreen() {
  const { orders } = useStore();

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Order History</Text>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.row}>
                <User size={16} color="#71717A" />
                <Text style={styles.customerName}>{item.customer_name || 'Unknown'}</Text>
              </View>
              <Text style={styles.date}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.row}>
                <Package size={16} color="#059669" />
                <Text style={styles.status}>{item.status}</Text>
              </View>
              <Text style={styles.amount}>${item.total_amount.toFixed(2)}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No orders yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA', padding: 16 },
  header: { fontSize: 24, fontWeight: 'bold', color: '#18181B', marginBottom: 16 },
  card: {
    backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  customerName: { fontSize: 16, fontWeight: 'bold', color: '#27272A' },
  date: { fontSize: 13, color: '#A1A1AA' },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  status: { fontSize: 14, color: '#059669', fontWeight: '600' },
  amount: { fontSize: 18, fontWeight: 'bold', color: '#18181B' },
  empty: { textAlign: 'center', marginTop: 40, color: '#71717A' }
});