import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Customer, Product, database } from '../database/db';
import { COLORS, SPACING } from '../theme';
import { AlertCircle, CheckCircle, Database, FileSpreadsheet, Trash2 } from 'lucide-react-native';

interface CatalogProps {
  products: Product[];
  customers: Customer[];
  onRefresh: () => void;
}

export const CatalogScreen: React.FC<CatalogProps> = ({
  products,
  customers,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'products' | 'customers'>('products');
  const [inputText, setInputText] = useState('');
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const setBanners = (success: string | null = null, error: string | null = null) => {
    setBannerSuccess(success);
    setBannerError(error);
  };

  const handleClearDatabase = async () => {
    Alert.alert('Clear Inventory', 'Are you sure you want to clear all products and customers from local SQLite database?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          await database.clearAllData();
          setBanners('Successfully cleared catalog database!');
          onRefresh();
        },
      },
    ]);
  };

  const handleLoadSampleStore = async () => {
    const sampleProducts: Product[] = [
      { name: 'Apples Fresh', price: 1.99, sku: 'APP-01' },
      { name: 'Organic Bananas', price: 0.89, sku: 'BAN-02' },
      { name: 'Whole Milk 1L', price: 2.49, sku: 'MLK-03' },
      { name: 'Sourdough Bread', price: 3.99, sku: 'BRD-04' },
      { name: 'Coffee Beans 500g', price: 9.99, sku: 'COF-05' },
      { name: 'Organic Yogurt', price: 4.49, sku: 'YOG-06' },
    ];
    const sampleCustomers: Customer[] = [
      { name: 'John Doe', email: 'john.doe@example.com', phone: '555-0199', code: 'C-101' },
      { name: 'Alice Smith', email: 'alice.smith@example.com', phone: '555-0123', code: 'C-102' },
      { name: 'Bob Johnson', email: 'bob.j@example.com', phone: '555-0145', code: 'C-103' },
      { name: 'Emily Davis', email: 'emily.d@example.com', phone: '555-0177', code: 'C-104' },
    ];
    await database.clearAllData();
    await database.insertProductsBulk(sampleProducts);
    await database.insertCustomersBulk(sampleCustomers);
    setBanners('Pre-populated sample catalog data (6 products, 4 customers)!');
    onRefresh();
  };

  // Simple split-by-comma custom CSV Parser mirroring Kotlin utility
  const parseCsvText = (text: string): string[][] => {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        // Handle Basic quotes split row
        let arr: string[] = [];
        let insideQuote = false;
        let current = '';
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            insideQuote = !insideQuote;
          } else if (char === ',' && !insideQuote) {
            arr.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        arr.push(current.trim());
        return arr;
      });
  };

  const handleImportCsv = async () => {
    if (!inputText.trim()) {
      setBanners(null, 'CSV input console is currently empty!');
      return;
    }

    try {
      const rows = parseCsvText(inputText);
      if (rows.length < 2) {
        throw new Error('CSV input must contain at least a header row and one item row!');
      }

      const headers = rows[0].map(h => h.trim().toLowerCase());

      if (activeTab === 'products') {
        // Cross-upload check: Prevent customer CSV crossing into products
        const hasCustomerHeaders = headers.some(h => h.includes('customer') || h.includes('stockiest') || h.includes('client'));
        if (hasCustomerHeaders) {
          throw new Error('Import rejected: This file appears to contain Customer headers. Please upload it under the Customers tab.');
        }

        const prodNameIdx = headers.findIndex(h => ['productname', 'name', 'product', 'item'].includes(h));
        const priceIdx = headers.findIndex(h => ['price', 'rate', 'cost'].includes(h));
        const skuIdx = headers.findIndex(h => ['productcode', 'sku', 'code'].includes(h));

        if (prodNameIdx === -1) {
          throw new Error('Failed to find header item name. Ensure columns contain "ProductName" or "name"!');
        }

        const list: Product[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const name = row[prodNameIdx];
          const priceRaw = priceIdx !== -1 ? (row[priceIdx] || '0').replace('$', '').replace('₹', '') : '0';
          const price = parseFloat(priceRaw) || 0;
          const sku = skuIdx !== -1 ? row[skuIdx] : '';

          if (name) {
            list.push({ name, price, sku });
          }
        }

        if (list.length > 0) {
          await database.insertProductsBulk(list);
          setBanners(`Successfully imported ${list.length} product catalog items!`);
          setInputText('');
          onRefresh();
        } else {
          throw new Error('No products could be parsed correctly. Review the comma separators.');
        }

      } else {
        // Cross-upload check: Prevent product CSV crossing into customers
        const hasProductHeaders = headers.some(h => h.includes('product') || h === 'sku' || h === 'price' || h === 'rate');
        if (hasProductHeaders) {
          throw new Error('Import rejected: This file appears to contain Product headers. Please upload it under the Products tab.');
        }

        const custNameIdx = headers.findIndex(h => ['customername', 'name', 'stockiestname', 'customer', 'client'].includes(h));
        const codeIdx = headers.findIndex(h => ['customercode', 'code', 'stockiestcode', 'id'].includes(h));

        if (custNameIdx === -1) {
          throw new Error('Failed to find header name column. Ensure columns contain "CustomerName" or "name"!');
        }

        const list: Customer[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const name = row[custNameIdx];
          const code = codeIdx !== -1 ? row[codeIdx] : '';
          const email = ''; // Restricted to customer code and name only
          const phone = ''; // Restricted to customer code and name only

          if (name) {
            list.push({ name, code, email, phone });
          }
        }

        if (list.length > 0) {
          await database.insertCustomersBulk(list);
          setBanners(`Successfully imported ${list.length} customer accounts!`);
          setInputText('');
          onRefresh();
        } else {
          throw new Error('No customers parsed. Review formatting constraints.');
        }
      }
    } catch (err: any) {
      setBanners(null, err.message || 'Parsing error - check inputs matches schema headers');
    }
  };

  const handleLoadTemplateText = () => {
    if (activeTab === 'products') {
      setInputText("ProductCode,ProductName,price\nCHZ-99,Gouda Cheese Wheels,12.50\nTEA-40,English Earl Grey Tea,4.10");
    } else {
      setInputText("CustomerCode,CustomerName\nC-201,John Connor");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Alert Banner */}
      {bannerSuccess && (
        <View style={styles.successBanner}>
          <CheckCircle size={18} color="#10B981" />
          <Text style={styles.bannerSuccessText}>{bannerSuccess}</Text>
          <TouchableOpacity onPress={() => setBannerSuccess(null)}>
            <Text style={styles.bannerCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {bannerError && (
        <View style={styles.errorBanner}>
          <AlertCircle size={18} color={COLORS.red600} />
          <Text style={styles.bannerErrorText}>{bannerError}</Text>
          <TouchableOpacity onPress={() => setBannerError(null)}>
            <Text style={styles.bannerCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Instants Tools */}
      <View style={styles.heroBox}>
        <Text style={styles.heroTitle}>⚡ Instant Testing Setup</Text>
        <Text style={styles.heroDesc}>
          Pre-populate product items, retail pricing, and customer catalog directories instantly to play with voice translations right away!
        </Text>
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleLoadSampleStore}>
            <Text style={styles.primaryBtnText}>Load Sample Store Data</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.outlineBtn} onPress={handleClearDatabase}>
            <Trash2 size={14} color={COLORS.red600} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bulk CSV upload box */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Upload Store Catalog Files</Text>

        {/* Csv Mini tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.miniTab, activeTab === 'products' && styles.miniTabActive]}
            onPress={() => {
              setActiveTab('products');
              setInputText('');
            }}
          >
            <Text style={[styles.miniTabText, activeTab === 'products' && styles.miniTabTextActive]}>
              Products CSV
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.miniTab, activeTab === 'customers' && styles.miniTabActive]}
            onPress={() => {
              setActiveTab('customers');
              setInputText('');
            }}
          >
            <Text style={[styles.miniTabText, activeTab === 'customers' && styles.miniTabTextActive]}>
              Customers CSV
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.catalogTip}>
          {activeTab === 'products'
            ? 'Format headers: ProductCode,ProductName,price'
            : 'Format headers: CustomerCode,CustomerName'}
        </Text>

        <TextInput
          style={styles.csvInput}
          multiline
          placeholder={
            activeTab === 'products'
              ? "ProductCode,ProductName,price\nCOF-10,Premium Bean Coffee,8.45"
              : "CustomerCode,CustomerName\nC-105,Sarah Conner"
          }
          placeholderTextColor="#A1A1AA"
          value={inputText}
          onChangeText={setInputText}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.actionBtnRow}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleImportCsv}>
            <Text style={styles.saveBtnText}>Process & Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.textBtn} onPress={handleLoadTemplateText}>
            <Text style={styles.textBtnText}>Use Template Text</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Live Previews inventory counters list */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Catalog Inventory</Text>
        <Text style={styles.cardSubtitle}>Showing imported items matching state in local database:</Text>

        <View style={styles.gridRow}>
          {/* Products Column preview */}
          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>Products Live</Text>
            <Text style={styles.gridCount}>{products.length}</Text>
            <View style={styles.itemPreviewList}>
              {products.slice(0, 3).map((item) => (
                <Text key={item.id} style={styles.previewBulletText} numberOfLines={1}>
                  • {item.name} (₹{item.price.toFixed(2)})
                </Text>
              ))}
            </View>
          </View>

          {/* Customers Columns preview */}
          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>Customers Live</Text>
            <Text style={styles.gridCount}>{customers.length}</Text>
            <View style={styles.itemPreviewList}>
              {customers.slice(0, 3).map((item) => (
                <Text key={item.id} style={styles.previewBulletText} numberOfLines={1}>
                  • {item.name} ({item.code || 'N/A'})
                </Text>
              ))}
            </View>
          </View>
        </View>
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
  successBanner: {
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  bannerSuccessText: {
    fontSize: 12,
    color: '#065F46',
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    backgroundColor: COLORS.red100,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  bannerErrorText: {
    fontSize: 12,
    color: COLORS.red900,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  bannerCloseText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.zinc400,
    paddingHorizontal: 4,
  },
  heroBox: {
    backgroundColor: COLORS.emeraldContainer,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.emeraldOnContainer,
    marginBottom: 6,
  },
  heroDesc: {
    fontSize: 12,
    color: COLORS.emeraldOnContainer,
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: COLORS.emeraldPrimary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  primaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  outlineBtn: {
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  card: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.zinc200,
    borderRadius: 16,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.darkZinc,
    marginBottom: SPACING.xs,
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.zinc700,
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.zinc200,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  miniTab: {
    paddingVertical: 10,
    marginRight: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  miniTabActive: {
    borderBottomColor: COLORS.emeraldPrimary,
  },
  miniTabText: {
    fontSize: 13,
    color: COLORS.zinc700,
  },
  miniTabTextActive: {
    fontWeight: '700',
    color: COLORS.emeraldPrimary,
  },
  catalogTip: {
    fontSize: 11,
    color: COLORS.zinc400,
    marginBottom: 8,
  },
  csvInput: {
    width: '100%',
    height: 115,
    borderWidth: 1,
    borderColor: COLORS.zinc200,
    borderRadius: 10,
    padding: 10,
    fontSize: 11,
    fontFamily: 'monospace',
    color: COLORS.darkZinc,
    textAlignVertical: 'top',
    backgroundColor: '#FAFAFA',
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  saveBtn: {
    backgroundColor: COLORS.emeraldPrimary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  textBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  textBtnText: {
    fontSize: 12,
    color: COLORS.emeraldPrimary,
    fontWeight: '600',
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  gridCard: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#F4F4F5',
    borderRadius: 12,
    padding: SPACING.md,
    marginHorizontal: 4,
  },
  gridLabel: {
    fontSize: 11,
    color: COLORS.zinc700,
  },
  gridCount: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.darkZinc,
    marginVertical: 4,
  },
  itemPreviewList: {
    marginTop: 4,
  },
  previewBulletText: {
    fontSize: 10,
    color: COLORS.zinc700,
    lineHeight: 14,
  },
});
export default CatalogScreen;
