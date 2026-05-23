import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { Customer, Product } from '../database/db';
import { COLORS, SPACING } from '../theme';
import { Plus, Trash2, X, Check, ShoppingBag, User } from 'lucide-react-native';

interface ActiveOrderItem {
  product: Product;
  quantity: number;
}

export interface ActiveOrderState {
  customer: Customer | null;
  items: ActiveOrderItem[];
  aiCost: number;
  originalTranscript?: string;
}

interface DetectedCardProps {
  visible: boolean;
  activeOrder: ActiveOrderState;
  allProducts: Product[];
  allCustomers: Customer[];
  onConfirm: (finalOrder: ActiveOrderState) => void;
  onCancel: () => void;
}

export const DetectedOrderConfirmationCard: React.FC<DetectedCardProps> = ({
  visible,
  activeOrder,
  allProducts,
  allCustomers,
  onConfirm,
  onCancel,
}) => {
  const [customer, setCustomer] = useState<Customer | null>(activeOrder.customer);
  const [items, setItems] = useState<ActiveOrderItem[]>(activeOrder.items);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [activeItemSelectIndex, setActiveItemSelectIndex] = useState<number | null>(null);

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.product.price * item.quantity, 0).toFixed(2);
  };

  const handleUpdateQty = (index: number, newQtyStr: string) => {
    const qty = parseInt(newQtyStr, 10);
    if (!isNaN(qty)) {
      const updated = [...items];
      updated[index] = { ...updated[index], quantity: Math.max(1, qty) };
      setItems(updated);
    }
  };

  const handleIncrementQty = (index: number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], quantity: updated[index].quantity + 1 };
    setItems(updated);
  };

  const handleDecrementQty = (index: number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], quantity: Math.max(1, updated[index].quantity - 1) };
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  const handleAddLineItem = () => {
    if (allProducts.length > 0) {
      setItems([...items, { product: allProducts[0], quantity: 1 }]);
    }
  };

  const handleSelectProduct = (itemIndex: number, prod: Product) => {
    const updated = [...items];
    updated[itemIndex] = { ...updated[itemIndex], product: prod };
    setItems(updated);
    setActiveItemSelectIndex(null);
  };

  const submitOrder = () => {
    if (!customer) {
      alert('Please select a customer before confirming the order!');
      return;
    }
    if (items.length === 0) {
      alert('Must include at least one product line item!');
      return;
    }
    onConfirm({
      customer,
      items,
      aiCost: activeOrder.aiCost,
      originalTranscript: activeOrder.originalTranscript,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalBg}>
        <View style={styles.cardContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconBox}>
                <ShoppingBag size={20} color={COLORS.white} />
              </View>
              <Text style={styles.headerTitle}>Review Voice Order</Text>
            </View>
            <TouchableOpacity onPress={onCancel} style={styles.closeBtn}>
              <X size={20} color={COLORS.darkZinc} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
            {/* Original Transcript Box */}
            {activeOrder.originalTranscript && (
              <View style={styles.transcriptBox}>
                <Text style={styles.boxTitle}>🔊 Heared Transcript</Text>
                <Text style={styles.transcriptText}>"{activeOrder.originalTranscript}"</Text>
              </View>
            )}

            {/* Customer Mapping Selection */}
            <Text style={styles.sectionLabel}>Customer Account</Text>
            <TouchableOpacity
              style={[styles.customerSelector, !customer && styles.customerSelectorError]}
              onPress={() => setShowCustomerDropdown(!showCustomerDropdown)}
            >
              <View style={styles.flexRow}>
                <User size={18} color={customer ? COLORS.emeraldPrimary : COLORS.red600} />
                <Text style={[styles.customerSelectorText, !customer && styles.textError]}>
                  {customer ? `${customer.name} (${customer.code || 'No Code'})` : 'No Match Found - Select customer'}
                </Text>
              </View>
              <Text style={styles.dropdownToggleIcon}>▼</Text>
            </TouchableOpacity>

            {showCustomerDropdown && (
              <View style={styles.dropdownBox}>
                {allCustomers.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setCustomer(c);
                      setShowCustomerDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{c.name} ({c.code || 'N/A'})</Text>
                    {customer?.id === c.id && <Check size={16} color={COLORS.emeraldPrimary} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Line Items List */}
            <Text style={styles.sectionLabel}>Order Items</Text>
            {items.map((item, index) => (
              <View key={index} style={styles.itemRowCard}>
                <View style={styles.itemInfoCol}>
                  {/* Product drop trigger */}
                  <TouchableOpacity
                    style={styles.productPickerBtn}
                    onPress={() => setActiveItemSelectIndex(activeItemSelectIndex === index ? null : index)}
                  >
                    <Text style={styles.productNameText}>{item.product.name}</Text>
                    <Text style={styles.productSkuText}>
                      SKU: {item.product.sku || 'N/A'} • ₹{item.product.price.toFixed(2)}
                    </Text>
                  </TouchableOpacity>

                  {activeItemSelectIndex === index && (
                    <View style={styles.innerPickerList}>
                      {allProducts.map((p) => (
                        <TouchableOpacity
                          key={p.id}
                          style={styles.innerPickerItem}
                          onPress={() => handleSelectProduct(index, p)}
                        >
                          <Text style={styles.innerPickerText}>{p.name} (₹{p.price.toFixed(2)})</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Quantity Editor Counter */}
                <View style={styles.quantityCol}>
                  <View style={styles.counterRow}>
                    <TouchableOpacity style={styles.counterBtn} onPress={() => handleDecrementQty(index)}>
                      <Text style={styles.counterBtnText}>-</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={styles.qtyInput}
                      keyboardType="numeric"
                      value={item.quantity.toString()}
                      onChangeText={(val) => handleUpdateQty(index, val)}
                    />
                    <TouchableOpacity style={styles.counterBtn} onPress={() => handleIncrementQty(index)}>
                      <Text style={styles.counterBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.totalItemPrice}>
                    ₹{(item.product.price * item.quantity).toFixed(2)}
                  </Text>
                </View>

                {/* Delete button */}
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleRemoveItem(index)}>
                  <Trash2 size={16} color={COLORS.red500} />
                </TouchableOpacity>
              </View>
            ))}

            {/* Add Item Button */}
            <TouchableOpacity style={styles.addItemBtn} onPress={handleAddLineItem}>
              <Plus size={16} color={COLORS.emeraldPrimary} />
              <Text style={styles.addItemBtnText}>Add Line Item</Text>
            </TouchableOpacity>

            {/* Grand Total cost details */}
            <View style={styles.priceSummaryBox}>
              <View style={styles.priceRow}>
                <Text style={styles.totalLabel}>Grand Total Amount:</Text>
                <Text style={styles.totalValue}>₹{calculateTotal()}</Text>
              </View>
              <View style={styles.gasRow}>
                <Text style={styles.gasLabel}>Gemini API Fuel Cost:</Text>
                <Text style={styles.gasValue}>${activeOrder.aiCost.toFixed(6)}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Bottom Button Rows */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.footerCancelBtn} onPress={onCancel}>
              <Text style={styles.footerCancelText}>Discard Draft</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerConfirmBtn} onPress={submitOrder}>
              <Text style={styles.footerConfirmText}>Place Order</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  cardContainer: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: COLORS.white,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.zinc200,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 32,
    height: 32,
    backgroundColor: COLORS.emeraldPrimary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.darkZinc,
  },
  closeBtn: {
    padding: 6,
  },
  scrollBody: {
    paddingHorizontal: SPACING.lg,
  },
  scrollContent: {
    paddingBottom: SPACING.xl,
  },
  transcriptBox: {
    backgroundColor: COLORS.lightZincBg,
    borderRadius: 14,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.zinc200,
  },
  boxTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.darkZinc,
    marginBottom: 4,
  },
  transcriptText: {
    fontSize: 13,
    color: '#52525B', // Zinc 600
    fontStyle: 'italic',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkZinc,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  customerSelector: {
    borderWidth: 1,
    borderColor: COLORS.zinc200,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerSelectorError: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  customerSelectorText: {
    marginLeft: 8,
    fontSize: 14,
    color: COLORS.darkZinc,
    fontWeight: '600',
  },
  textError: {
    color: COLORS.red500,
  },
  dropdownToggleIcon: {
    fontSize: 12,
    color: COLORS.zinc400,
  },
  dropdownBox: {
    borderWidth: 1,
    borderColor: COLORS.zinc200,
    borderRadius: 12,
    marginTop: 4,
    backgroundColor: COLORS.white,
    maxHeight: 150,
  },
  dropdownItem: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F4F5',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownItemText: {
    fontSize: 13,
    color: COLORS.darkZinc,
  },
  itemRowCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.zinc200,
    borderRadius: 14,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemInfoCol: {
    flex: 2,
    justifyContent: 'center',
  },
  productPickerBtn: {
    paddingVertical: 4,
  },
  productNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkZinc,
  },
  productSkuText: {
    fontSize: 11,
    color: COLORS.zinc400,
    marginTop: 2,
  },
  innerPickerList: {
    backgroundColor: COLORS.lightZincBg,
    borderRadius: 8,
    padding: 4,
    marginTop: 8,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: COLORS.zinc200,
  },
  innerPickerItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.zinc200,
  },
  innerPickerText: {
    fontSize: 12,
    color: COLORS.darkZinc,
  },
  quantityCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.zinc200,
    borderRadius: 8,
    overflow: 'hidden',
  },
  counterBtn: {
    width: 24,
    height: 24,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkZinc,
  },
  qtyInput: {
    width: 28,
    height: 24,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.darkZinc,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.zinc200,
    borderRightWidth: 1,
    borderRightColor: COLORS.zinc200,
    padding: 0,
  },
  totalItemPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.emeraldPrimary,
    marginTop: 4,
  },
  deleteBtn: {
    padding: 8,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.emeraldPrimary,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 6,
  },
  addItemBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.emeraldPrimary,
    marginLeft: 6,
  },
  priceSummaryBox: {
    borderTopWidth: 1,
    borderTopColor: COLORS.zinc200,
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.darkZinc,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.emeraldPrimary,
  },
  gasRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gasLabel: {
    fontSize: 11,
    color: COLORS.zinc400,
  },
  gasValue: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: COLORS.zinc700,
  },
  footerRow: {
    flexDirection: 'row',
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.zinc200,
    backgroundColor: '#FAFAFA',
  },
  footerCancelBtn: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.zinc200,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  footerCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.darkZinc,
  },
  footerConfirmBtn: {
    flex: 1.3,
    backgroundColor: COLORS.emeraldPrimary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  footerConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
});
export default DetectedOrderConfirmationCard;
