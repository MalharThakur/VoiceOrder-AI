import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
} from 'react-native';
import { OrderWithCustomer } from '../database/db';
import { COLORS, SPACING } from '../theme';
import { ShoppingCart, Calendar, DollarSign, BrainCircuit } from 'lucide-react-native';

interface HistoryProps {
  orders: OrderWithCustomer[];
}

export const HistoryScreen: React.FC<HistoryProps> = ({ orders }) => {

  const formatDate = (timestamp: number) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return '';
    }
  };

  const renderOrderItem = ({ item }: { item: OrderWithCustomer }) => {
    return (
      <View style={styles.orderCard}>
        {/* Top row */}
        <View style={styles.orderHeader}>
          <View style={styles.customerInfoCol}>
            <Text style={styles.customerName}>{item.customer_name || 'Unknown Retailer'}</Text>
            {item.customer_code && (
              <Text style={styles.customerCode}>Code: {item.customer_code}</Text>
            )}
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Date and cost rows */}
        <View style={styles.detailsGroup}>
          <View style={styles.detailRow}>
            <Calendar size={14} color={COLORS.zinc400} />
            <Text style={styles.detailText}>{formatDate(item.created_at)}</Text>
          </View>

          <View style={styles.statFlexRow}>
            <View style={styles.statItem}>
              <DollarSign size={14} color={COLORS.emeraldPrimary} />
              <Text style={styles.statLabel}>Total: </Text>
              <Text style={styles.statValue}>₹{item.total_amount.toFixed(2)}</Text>
            </View>

            <View style={[styles.statItem, styles.aiCostContainer]}>
              <BrainCircuit size={14} color="#71717A" />
              <Text style={styles.statLabel}>AI Cost: </Text>
              <Text style={styles.aiCostValue}>${item.ai_cost.toFixed(5)}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconBox}>
          <ShoppingCart size={48} color={COLORS.zinc200} />
        </View>
        <Text style={styles.emptyTitle}>No Orders Placed Yet</Text>
        <Text style={styles.emptySubtitle}>
          Process orders by voice or upload sample catalog items in other sections to see live transaction records here.
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => (item.id?.toString() || Math.random().toString())}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightZincBg,
  },
  listContent: {
    padding: SPACING.lg,
    flexGrow: 1,
  },
  orderCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.zinc200,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  customerInfoCol: {
    flex: 1,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.darkZinc,
  },
  customerCode: {
    fontSize: 12,
    color: COLORS.zinc400,
    marginTop: 2,
  },
  statusPill: {
    backgroundColor: COLORS.emeraldContainer,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.emeraldOnContainer,
  },
  divider: {
    height: 1,
    backgroundColor: '#F4F4F5',
    marginVertical: SPACING.xs,
  },
  detailsGroup: {
    paddingTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  detailText: {
    fontSize: 12,
    color: COLORS.zinc700,
    marginLeft: 6,
  },
  statFlexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiCostContainer: {
    backgroundColor: '#F4F4F5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.zinc700,
    marginLeft: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.emeraldPrimary,
  },
  aiCostValue: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '600',
    color: '#27272A', // Zinc 800
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyIconBox: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: COLORS.zinc200,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.zinc700,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: COLORS.zinc400,
    textAlign: 'center',
    lineHeight: 18,
  },
});
export default HistoryScreen;
