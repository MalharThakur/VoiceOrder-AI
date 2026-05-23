import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { geminiService } from '../services/GeminiService';
import { Customer, Product } from '../database/db';
import { COLORS, SPACING } from '../theme';
import { PulseIndicator } from '../components/PulseIndicator';
import { ActiveOrderState } from '../components/DetectedOrderConfirmationCard';
import { Mic, Square, Play, AlertCircle } from 'lucide-react-native';

interface VoiceScreenProps {
  products: Product[];
  customers: Customer[];
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  setDetectedOrder: (order: ActiveOrderState | null) => void;
  onRefresh: () => void;
}

export const VoiceEntryScreen: React.FC<VoiceScreenProps> = ({
  products,
  customers,
  isProcessing,
  setIsProcessing,
  setDetectedOrder,
  onRefresh,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [txtCommand, setTxtCommand] = useState('');
  const [statusText, setStatusText] = useState('IDLE');

  // Request Permissions & Record
  const startRecording = async () => {
    try {
      setErrorMessage(null);
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        setErrorMessage('Microphone permissions are required to record and parse orders by voice.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
      setStatusText('REC');
    } catch (err: any) {
      console.error('Failed to start recording', err);
      setErrorMessage('Could not initialize microphone recorder. Try using the Simulator Fallback keyboard box below!');
    }
  };

  const stopAndProcessRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    setStatusText('Processing Voice...');
    setIsProcessing(true);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) throw new Error('No audio file path returned from recording.');

      // Check DB states
      if (customers.length === 0 || products.length === 0) {
        throw new Error('Please configure items in the "Catalog Files" tab first so the AI can match your audio input!');
      }

      // Convert audio file to Base64 String
      setStatusText('Reading audio content...');
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Transcribe via Gemini
      setStatusText('Gemini transcribing audio...');
      const transcriptionText = await geminiService.transcribeAudio(base64Audio);

      if (!transcriptionText || transcriptionText.includes('[Silence]') || transcriptionText.toLowerCase().trim() === 'silence') {
        throw new Error('AI detected silence or background static. Tip: speak clearly or use the "Text Command (Simulator)" box below to test!');
      }

      // Process Structured Order Matching
      setStatusText('AI extraction mapping...');
      await resolveTextToOrder(transcriptionText);

    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred while transcribing voice.');
      console.error(err);
    } finally {
      setIsProcessing(false);
      setStatusText('IDLE');
    }
  };

  const discardRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    setStatusText('IDLE');
    try {
      await recording.stopAndUnloadAsync();
      setRecording(null);
    } catch (err) {
      console.error('Error discarding', err);
    }
  };

  // Maps text strings verbatim or fuzzily into customer/product rows
  const resolveTextToOrder = async (text: string) => {
    if (customers.length === 0 || products.length === 0) {
      setErrorMessage('Please load sample catalog data before processing directions!');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const result = await geminiService.processTextOrder(text, customers, products);
      if (!result) {
        throw new Error('AI could not extract order parameters. Double check details.');
      }

      // Local fuzzy mapping fallback matching logic identical to Kotlin side
      const fuzzyMatchCustomer = (cid: number | null, name: string | null) => {
        if (cid !== null && cid !== undefined) {
          const match = customers.find(c => c.id === cid);
          if (match) return match;
        }
        const target = (name || '').toLowerCase().trim();
        if (!target) return null;

        // 1. Exact match
        const exact = customers.find(c => c.name.toLowerCase().trim() === target);
        if (exact) return exact;

        // 2. Contains match (either way)
        const contains = customers.find(c => c.name.toLowerCase().includes(target) || target.includes(c.name.toLowerCase()));
        if (contains) return contains;

        // 3. Word token overlap
        const targetWords = target.split(/\s+/).filter(w => w.length > 2);
        if (targetWords.length > 0) {
          let bestMatch: Customer | null = null;
          let maxOverlap = 0;
          for (const c of customers) {
            const nameLower = c.name.toLowerCase();
            const overlap = targetWords.filter(word => nameLower.includes(word)).length;
            if (overlap > maxOverlap) {
              maxOverlap = overlap;
              bestMatch = c;
            }
          }
          if (maxOverlap > 0) return bestMatch;
        }

        return null;
      };

      const fuzzyMatchProduct = (pid: number | null, name: string | null) => {
        if (pid !== null && pid !== undefined) {
          const match = products.find(p => p.id === pid);
          if (match) return match;
        }
        const target = (name || '').toLowerCase().trim();
        if (!target) return null;

        // Normalize plurals like "s" or "es"
        let targetNormalized = target;
        if (target.endsWith('s') && !target.endsWith('ss')) {
          targetNormalized = target.slice(0, -1);
        } else if (target.endsWith('es') && (target.endsWith('ches') || target.endsWith('shes') || target.endsWith('xes'))) {
          targetNormalized = target.slice(0, -2);
        }

        // 1. Exact match on normalized or original
        const exact = products.find(p => {
          const pLower = p.name.toLowerCase().trim();
          return pLower === target || pLower === targetNormalized;
        });
        if (exact) return exact;

        // 2. Contains Match (either way)
        const contains = products.find(p => {
          const pLower = p.name.toLowerCase();
          return pLower.includes(target) || target.includes(pLower) ||
                 pLower.includes(targetNormalized) || targetNormalized.contains(pLower);
        });
        if (contains) return contains;

        // 3. Word-by-word overlap
        const targetWords = target.split(/\s+/)
          .map(w => w.endsWith('s') ? w.slice(0, -1) : w)
          .filter(w => w.length > 2);
        if (targetWords.length > 0) {
          let bestMatch: Product | null = null;
          let maxOverlap = 0;
          for (const p of products) {
            const nameLower = p.name.toLowerCase();
            const overlap = targetWords.filter(word => nameLower.includes(word)).length;
            if (overlap > maxOverlap) {
              maxOverlap = overlap;
              bestMatch = p;
            }
          }
          if (maxOverlap > 1) return bestMatch;
          if (maxOverlap > 0 && bestMatch !== null) return bestMatch;
        }

        return null;
      };

      const matchedCustomer = fuzzyMatchCustomer(result.customerId, result.detectedCustomerName);
      const matchedItems = result.items.map(item => {
        const product = fuzzyMatchProduct(item.productId, item.detectedProductName);
        return {
          product: product || null,
          quantity: item.quantity,
        };
      }).filter(item => item.product !== null) as { product: Product; quantity: number }[];

      if (matchedItems.length === 0) {
        throw new Error(`The AI transcribing was: "${text}" but we failed to match any products in your imported Catalog!`);
      }

      setDetectedOrder({
        customer: matchedCustomer,
        items: matchedItems,
        aiCost: result.aiCost,
        originalTranscript: text,
      });

    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred during AI parsing.');
    } finally {
      setIsProcessing(false);
    }
  };

  const simulateRandomPrompt = () => {
    const samples = [
      'Hey Gemini, create an order for Alice Smith including three sourdough breads and one pack of coffee beans please.',
      'Hello! I need to place an order for Bob Johnson for two whole milk bottles and one organic yogurt.',
      'Urgent order for Emily Davis: three apples fresh',
    ];
    const rand = samples[Math.floor(Math.random() * samples.length)];
    setTxtCommand(rand);
    resolveTextToOrder(rand);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Mic Capture Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tap to Speak Order</Text>
        <Text style={styles.cardSubtitle}>
          {isRecording
            ? 'Listening closely... tap red stop to process'
            : 'Click the micro action button and state what catalog items you want to order.'}
        </Text>

        <PulseIndicator isRecording={isRecording}>
          <TouchableOpacity
            style={[styles.micBtn, isRecording && styles.micBtnRec]}
            onPress={isRecording ? stopAndProcessRecording : startRecording}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color={COLORS.white} size="large" />
            ) : isRecording ? (
              <Square size={32} color={COLORS.white} />
            ) : (
              <Mic size={32} color={COLORS.white} />
            )}
          </TouchableOpacity>
        </PulseIndicator>

        <Text style={[styles.statusBadge, isRecording && styles.statusBadgeRec]}>
          {isProcessing ? statusText : isRecording ? 'REC' : 'IDLE'}
        </Text>

        {!isRecording && !isProcessing && (
          <TouchableOpacity style={styles.simulateBtn} onPress={simulateRandomPrompt}>
            <Play size={14} color={COLORS.darkZinc} />
            <Text style={styles.simulateBtnText}>Simulate Spoken Command</Text>
          </TouchableOpacity>
        )}

        {isRecording && (
          <TouchableOpacity style={styles.discardBtn} onPress={discardRecording}>
            <Text style={styles.discardBtnText}>Discard</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Error Card */}
      {errorMessage && (
        <View style={styles.errorCard}>
          <AlertCircle size={20} color={COLORS.red600} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {/* Manual Input Fallback */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⌨ Text Command (Simulator Fallback)</Text>
        <Text style={styles.fallbackDesc}>
          If your simulator environment cannot access standard microphone controls, type, paste, or tap a layout preset to run mapping locally:
        </Text>

        <TextInput
          style={styles.textInput}
          multiline
          placeholder="E.g., Place order of 3 Apples Fresh and 2 Whole Milk 1L for Bob Johnson"
          placeholderTextColor="#A1A1AA"
          value={txtCommand}
          onChangeText={setTxtCommand}
        />

        <TouchableOpacity
          style={[styles.processBtn, (!txtCommand.trim() || isProcessing) && styles.processBtnDisabled]}
          disabled={!txtCommand.trim() || isProcessing}
          onPress={() => resolveTextToOrder(txtCommand)}
        >
          <Text style={styles.processBtnText}>
            {isProcessing ? 'AI Processing...' : 'Process Instruction'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.quickLabel}>⏱ Quick Test Commands (Tap to parse):</Text>
        <View style={styles.quickGroup}>
          {[
            'I want to place an order of 3 Sourdough Breads and 1 Coffee Beans for Alice Smith',
            'Place an order of 2 Whole Milk 1L and 1 Organic Yogurt for Bob Johnson',
            'Quick order: Emily Davis wants 3 Apples Fresh',
          ].map((prompt, idx) => (
            <TouchableOpacity key={idx} style={styles.quickPill} onPress={() => {
              setTxtCommand(prompt);
              resolveTextToOrder(prompt);
            }}>
              <Text style={styles.quickPillText}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tips Guide */}
      <View style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>💡 Voice Tips</Text>
        <Text style={styles.tipsText}>• "Place an order of 15 Apples Fresh and 3 Whole Milk for Alice Smith"</Text>
        <Text style={styles.tipsText}>• "Create a new order for Emily Davis: 1 Organic Bananas, 2 sourdough bread and some yogurt"</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightZincBg,
  },
  content: {
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.zinc200,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.darkZinc,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.zinc700,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: SPACING.sm,
  },
  micBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.emeraldPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.emeraldPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  micBtnRec: {
    backgroundColor: COLORS.red500,
    shadowColor: COLORS.red500,
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.zinc700,
    letterSpacing: 1,
    marginTop: SPACING.sm,
  },
  statusBadgeRec: {
    color: COLORS.red500,
  },
  simulateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: COLORS.zinc200,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: SPACING.md,
  },
  simulateBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.darkZinc,
    marginLeft: 6,
  },
  discardBtn: {
    backgroundColor: COLORS.red500,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginTop: SPACING.md,
  },
  discardBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  errorCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.red100,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.red900,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  fallbackDesc: {
    fontSize: 12,
    color: COLORS.zinc700,
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  textInput: {
    width: '100%',
    height: 80,
    borderWidth: 1,
    borderColor: COLORS.zinc200,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: COLORS.darkZinc,
    textAlignVertical: 'top',
    backgroundColor: '#FAFAFA',
  },
  processBtn: {
    width: '100%',
    backgroundColor: COLORS.emeraldPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: SPACING.md,
  },
  processBtnDisabled: {
    backgroundColor: COLORS.zinc400,
  },
  processBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.zinc700,
    alignSelf: 'flex-start',
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  quickGroup: {
    width: '100%',
  },
  quickPill: {
    backgroundColor: '#F4F4F5',
    borderWidth: 1,
    borderColor: COLORS.zinc200,
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  quickPillText: {
    fontSize: 11,
    color: COLORS.darkZinc,
  },
  tipsCard: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: SPACING.md,
  },
  tipsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.emeraldOnContainer,
    marginBottom: SPACING.xs,
  },
  tipsText: {
    fontSize: 11,
    color: COLORS.emeraldOnContainer,
    lineHeight: 16,
  },
});
export default VoiceEntryScreen;
