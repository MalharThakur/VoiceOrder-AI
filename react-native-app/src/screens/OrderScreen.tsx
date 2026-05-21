import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Audio } from 'expo-av';
import { useStore } from '../store/useStore';
import { processVoiceOrder } from '../services/GeminiService';
import { Mic, Square, Check, X, Plus, Minus, Trash2 } from 'lucide-react-native';

export default function OrderScreen() {
  const {
    products, customers, isRecording, setIsRecording,
    isProcessing, setIsProcessing, setErrorMessage, setSuccessMessage,
    detectedOrder, setDetectedOrder, cancelDetectedOrder, confirmAndPlaceOrder,
    updateDetectedItemQuantity, removeDetectedItem
  } = useStore();

  const [recording, setRecording] = useState<Audio.Recording | null>(null);

  async function startRecording() {
    try {
      setErrorMessage(null);
      setSuccessMessage(null);
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
      setErrorMessage("Microphone permission denied.");
    }
  }

  async function stopRecording() {
    setRecording(null);
    setIsRecording(false);
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) return;

      setIsProcessing(true);

      const result = await processVoiceOrder(uri, customers, products);

      if (result) {
        // Map result to ActiveOrderState
        const mappedCustomer = customers.find(c => c.id === result.customerId) || null;

        const mappedItems = result.items.map(item => {
          let matchedProduct = products.find(p => p.id === item.productId);

          if (!matchedProduct) {
             // Fallback dummy product if not found
             matchedProduct = { id: -1, name: item.detectedProductName, price: 0.0 };
          }

          const suggestions = products.filter(p => item.suggestedProductIds.includes(p.id));

          return {
            product: matchedProduct,
            quantity: item.quantity,
            suggestions
          };
        });

        setDetectedOrder({
          customer: mappedCustomer,
          items: mappedItems,
          aiCost: result.totalCost
        });
      } else {
        setErrorMessage("Could not parse order from audio.");
      }

    } catch (error) {
      setErrorMessage("Error processing audio: " + String(error));
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Voice Order AI</Text>

      {/* Recording Section */}
      <View style={styles.recordContainer}>
        <TouchableOpacity
          style={[styles.recordButton, isRecording ? styles.recording : null]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
        >
          {isRecording ? <Square color="white" size={32} /> : <Mic color="white" size={32} />}
        </TouchableOpacity>
        <Text style={styles.recordText}>
          {isRecording ? "Recording... Tap to stop" : "Tap to speak order"}
        </Text>
      </View>

      {isProcessing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={styles.loadingText}>Processing with Gemini AI...</Text>
        </View>
      )}

      {/* Active Order Confirmation */}
      {detectedOrder && (
        <View style={styles.orderCard}>
          <Text style={styles.cardTitle}>Confirm Order</Text>
          <Text style={styles.customerText}>
            Customer: {detectedOrder.customer?.name || "Unknown Customer"}
          </Text>

          <View style={styles.divider} />

          {detectedOrder.items.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.product.name}</Text>
                <Text style={styles.itemPrice}>${item.product.price.toFixed(2)}</Text>
              </View>

              <View style={styles.qtyContainer}>
                <TouchableOpacity onPress={() => updateDetectedItemQuantity(index, item.quantity - 1)}>
                  <Minus size={20} color="#52525B" />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{item.quantity}</Text>
                <TouchableOpacity onPress={() => updateDetectedItemQuantity(index, item.quantity + 1)}>
                  <Plus size={20} color="#52525B" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => removeDetectedItem(index)}>
                <Trash2 size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={cancelDetectedOrder}>
              <X color="#52525B" size={20} />
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={confirmAndPlaceOrder}>
              <Check color="white" size={20} />
              <Text style={styles.confirmText}>Place Order</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA', padding: 16 },
  header: { fontSize: 24, fontWeight: 'bold', color: '#18181B', marginBottom: 20 },
  recordContainer: { alignItems: 'center', marginVertical: 30 },
  recordButton: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#059669',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 5
  },
  recording: { backgroundColor: '#EF4444' },
  recordText: { marginTop: 12, fontSize: 16, color: '#52525B', fontWeight: '500' },
  loadingContainer: { alignItems: 'center', marginVertical: 20 },
  loadingText: { marginTop: 10, color: '#059669', fontWeight: 'bold' },

  orderCard: {
    backgroundColor: 'white', borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3
  },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#18181B' },
  customerText: { fontSize: 16, color: '#059669', marginTop: 4, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#E4E4E7', marginVertical: 12 },

  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#27272A' },
  itemPrice: { fontSize: 13, color: '#71717A' },

  qtyContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16 },
  qtyText: { fontSize: 16, fontWeight: 'bold', marginHorizontal: 12 },

  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  cancelBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 12, borderWidth: 1, borderColor: '#E4E4E7', borderRadius: 8, marginRight: 8 },
  cancelText: { color: '#52525B', fontWeight: 'bold', marginLeft: 8 },
  confirmBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 12, backgroundColor: '#059669', borderRadius: 8, marginLeft: 8 },
  confirmText: { color: 'white', fontWeight: 'bold', marginLeft: 8 }
});