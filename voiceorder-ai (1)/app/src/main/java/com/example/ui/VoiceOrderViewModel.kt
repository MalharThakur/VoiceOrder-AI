package com.example.ui

import android.app.Application
import android.media.MediaRecorder
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.*
import com.example.util.CsvParser
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.io.File

class VoiceOrderViewModel(application: Application) : AndroidViewModel(application) {

    private val db = AppDatabase.getDatabase(application)
    private val repository = VoiceOrderRepository(db)
    private val geminiService = GeminiService()

    // Database flow streams
    val products: StateFlow<List<Product>> = repository.allProducts
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val customers: StateFlow<List<Customer>> = repository.allCustomers
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val orders: StateFlow<List<OrderWithCustomer>> = repository.allOrders
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Recording and extraction processing states
    private val _isRecording = MutableStateFlow(false)
    val isRecording: StateFlow<Boolean> = _isRecording.asStateFlow()

    private val _isProcessing = MutableStateFlow(false)
    val isProcessing: StateFlow<Boolean> = _isProcessing.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val _successMessage = MutableStateFlow<String?>(null)
    val successMessage: StateFlow<String?> = _successMessage.asStateFlow()

    fun clearSuccessMessage() {
        _successMessage.value = null
    }

    fun setErrorMessage(msg: String?) {
        _errorMessage.value = msg
    }

    // Active order confirmation builder state
    data class ActiveOrderState(
        val customer: Customer?,
        val items: List<ActiveOrderItem>,
        val aiCost: Double,
        val originalTranscript: String? = null
    )

    data class ActiveOrderItem(
        val product: Product,
        val quantity: Int,
        val suggestions: List<Product> = emptyList() // Ambiguous matches if any
    )

    private val _detectedOrder = MutableStateFlow<ActiveOrderState?>(null)
    val detectedOrder: StateFlow<ActiveOrderState?> = _detectedOrder.asStateFlow()

    // Recording cache
    private var mediaRecorder: MediaRecorder? = null
    private var audioFile: File? = null

    fun startRecording() {
        val context = getApplication<Application>().applicationContext
        try {
            _errorMessage.value = null
            audioFile = File.createTempFile("voice_order_", ".mp4", context.cacheDir)
            
            @Suppress("DEPRECATION")
            mediaRecorder = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                MediaRecorder(context)
            } else {
                MediaRecorder()
            }.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioSamplingRate(44100)
                setAudioEncodingBitRate(128000)
                setAudioChannels(1)
                setOutputFile(audioFile!!.absolutePath)
                prepare()
                start()
            }
            _isRecording.value = true
        } catch (e: Exception) {
            _errorMessage.value = "Failed to start standard mic recorder: ${e.message}"
            Log.e("VoiceOrderViewModel", "Error starting MediaRecorder", e)
        }
    }

    fun stopRecordingAndProcess() {
        _isRecording.value = false
        try {
            mediaRecorder?.apply {
                stop()
                release()
            }
            mediaRecorder = null
            
            val file = audioFile
            if (file != null && file.exists()) {
                processVoiceFile(file)
            }
        } catch (e: Exception) {
            _errorMessage.value = "Failed to stop recording: ${e.message}"
            Log.e("VoiceOrderViewModel", "Error stopping MediaRecorder", e)
        }
    }

    fun cancelRecording() {
        _isRecording.value = false
        try {
            mediaRecorder?.apply {
                stop()
                release()
            }
            mediaRecorder = null
            audioFile?.delete()
            audioFile = null
        } catch (e: Exception) {
            Log.e("VoiceOrderViewModel", "Error canceling recording", e)
        }
    }

    private fun fuzzyMatchCustomer(
        customerId: Int?,
        detectedName: String?,
        customersList: List<Customer>
    ): Customer? {
        if (customerId != null) {
            customersList.find { it.id == customerId }?.let { return it }
        }
        val target = (detectedName ?: "").lowercase().trim()
        if (target.isEmpty()) return null

        // 1. Exact match
        customersList.find { it.name.lowercase().trim() == target }?.let { return it }

        // 2. Full contains
        customersList.find { it.name.lowercase().contains(target) || target.contains(it.name.lowercase()) }?.let { return it }

        // 3. Word token overlap
        val targetWords = target.split("\\s+".toRegex()).filter { it.length > 2 }
        if (targetWords.isNotEmpty()) {
            var bestMatch: Customer? = null
            var maxOverlap = 0
            for (c in customersList) {
                val nameLower = c.name.lowercase()
                val overlap = targetWords.count { word -> nameLower.contains(word) }
                if (overlap > maxOverlap) {
                    maxOverlap = overlap
                    bestMatch = c
                }
            }
            if (maxOverlap > 0) return bestMatch
        }

        return null
    }

    private fun fuzzyMatchProduct(
        productId: Int?,
        detectedProductName: String?,
        productsList: List<Product>
    ): Product? {
        if (productId != null) {
            productsList.find { it.id == productId }?.let { return it }
            // If the ID is present but maybe not matched properly, we can try matching by ID first
        }
        val target = (detectedProductName ?: "").lowercase().trim()
        if (target.isEmpty()) return null

        // Normalize plurals like "s" or "es"
        val targetNormalized = if (target.endsWith("s") && !target.endsWith("ss")) {
            target.dropLast(1)
        } else if (target.endsWith("es") && (target.endsWith("ches") || target.endsWith("shes") || target.endsWith("xes"))) {
            target.dropLast(2)
        } else {
            target
        }

        // 1. Exact match on normalized or original
        productsList.find { 
            val pLower = it.name.lowercase().trim()
            pLower == target || pLower == targetNormalized 
        }?.let { return it }

        // 2. Contains Match (either way)
        productsList.find { 
            val pLower = it.name.lowercase()
            pLower.contains(target) || target.contains(pLower) ||
                    pLower.contains(targetNormalized) || targetNormalized.contains(pLower)
        }?.let { return it }

        // 3. Word-by-word overlap
        val targetWords = target.split("\\s+".toRegex())
            .map { if (it.endsWith("s")) it.dropLast(1) else it }
            .filter { it.length > 2 }
        if (targetWords.isNotEmpty()) {
            var bestMatch: Product? = null
            var maxOverlap = 0
            for (p in productsList) {
                val nameLower = p.name.lowercase()
                val overlap = targetWords.count { word -> nameLower.contains(word) }
                if (overlap > maxOverlap) {
                    maxOverlap = overlap
                    bestMatch = p
                }
            }
            if (maxOverlap > 1) return bestMatch // High quality multi-word overlap
            if (maxOverlap > 0 && bestMatch != null) return bestMatch
        }

        return null
    }

    fun processTextCommand(text: String) {
        if (text.isBlank()) return
        _isProcessing.value = true
        _errorMessage.value = null
        viewModelScope.launch {
            try {
                val currentCustomers = customers.value
                val currentProducts = products.value

                if (currentCustomers.isEmpty() || currentProducts.isEmpty()) {
                    _errorMessage.value = "Please load sample data or upload CSVs before entering orders, so the AI can match products and customers in your database!"
                    return@launch
                }

                val result = geminiService.processTextOrder(text, currentCustomers, currentProducts)
                if (result == null) {
                    _errorMessage.value = "AI failed to extract details from your typed text. Please check your internet connection."
                    return@launch
                }

                // Map results back to local database entities with precise fuzzy logic fallback
                val matchedCustomer = fuzzyMatchCustomer(result.customerId, result.detectedCustomerName, currentCustomers)
                
                val matchedItems = result.items.mapNotNull { item ->
                    val product = fuzzyMatchProduct(item.productId, item.detectedProductName, currentProducts)
                    if (product == null) {
                        Log.w("VoiceOrderViewModel", "Ignoring product with no db match: ${item.detectedProductName}")
                        return@mapNotNull null
                    }

                    val suggestionsList = item.suggestedProductIds.mapNotNull { id ->
                        currentProducts.find { it.id == id }
                    }

                    ActiveOrderItem(product, item.quantity, suggestionsList)
                }

                if (matchedItems.isNotEmpty()) {
                    _detectedOrder.value = ActiveOrderState(
                        customer = matchedCustomer,
                        items = matchedItems,
                        aiCost = result.aiCost,
                        originalTranscript = text
                    )
                } else {
                    _errorMessage.value = "The AI read the command: \"$text\" but could not match it to any of the products in your imported catalog. Please double-check that the product names are close to the catalog items."
                }
            } catch (e: Exception) {
                _errorMessage.value = "Command processing error: ${e.message}"
                Log.e("VoiceOrderViewModel", "Exception processing text command", e)
            } finally {
                _isProcessing.value = false
            }
        }
    }

    private fun processVoiceFile(file: File) {
        _isProcessing.value = true
        _errorMessage.value = null
        viewModelScope.launch {
            try {
                val currentCustomers = customers.value
                val currentProducts = products.value

                if (currentCustomers.isEmpty() || currentProducts.isEmpty()) {
                    _errorMessage.value = "Please load sample data or upload CSVs before entering orders, so the AI can match products and customers in your database!"
                    return@launch
                }

                // Step 1: Transcribe the audio first using Gemini Multimodal
                _errorMessage.value = "Transcribing audio..."
                val transcription = geminiService.transcribeAudio(file)
                _errorMessage.value = null

                if (transcription.isNullOrBlank()) {
                    _errorMessage.value = "AI failed to hear any words in the audio. Please speak clearly, check mic permissions, or use 'Text Command (Simulator Fallback)' box."
                    return@launch
                }

                if (transcription.contains("[Silence]", ignoreCase = true) || transcription.lowercase().trim().contains("silence")) {
                    _errorMessage.value = "AI detected only silence or background static. Tip: Since streaming emulators in browser windows do not always have physical access to your microphone, please type or tap a command in the 'Text Command (Simulator Fallback)' box below to test matching instantly!"
                    return@launch
                }

                // Step 2: Use the transcribed text with our robust text mapping layout
                val result = geminiService.processTextOrder(transcription, currentCustomers, currentProducts)
                if (result == null) {
                    _errorMessage.value = "The AI transcribed your voice as: \"$transcription\" but failed to extract matching items. Please check your spelling or register matching catalog items."
                    return@launch
                }

                // Map results back to local database entities with precise fuzzy logic fallback
                val matchedCustomer = fuzzyMatchCustomer(result.customerId, result.detectedCustomerName, currentCustomers)
                
                val matchedItems = result.items.mapNotNull { item ->
                    val product = fuzzyMatchProduct(item.productId, item.detectedProductName, currentProducts)
                    if (product == null) {
                        Log.w("VoiceOrderViewModel", "Ignoring product with no db match: ${item.detectedProductName}")
                        return@mapNotNull null
                    }

                    val suggestionsList = item.suggestedProductIds.mapNotNull { id ->
                        currentProducts.find { it.id == id }
                    }

                    ActiveOrderItem(product, item.quantity, suggestionsList)
                }

                if (matchedItems.isNotEmpty()) {
                    _detectedOrder.value = ActiveOrderState(
                        customer = matchedCustomer,
                        items = matchedItems,
                        aiCost = result.aiCost,
                        originalTranscript = transcription
                    )
                } else {
                    _errorMessage.value = "The AI heard your voice: \"$transcription\", but could not match what you said to any products in your imported catalog. Tip: Please check that your products exist in the Catalog first, or type/tap a command below!"
                }
            } catch (e: Exception) {
                _errorMessage.value = "Voice processing error: ${e.message}"
                Log.e("VoiceOrderViewModel", "Exception processing audio file", e)
            } finally {
                _isProcessing.value = false
                file.delete()
            }
        }
    }

    // Active order confirmation state manipulators
    fun selectDetectedCustomer(customer: Customer) {
        _detectedOrder.update { it?.copy(customer = customer) }
    }

    fun removeDetectedItem(index: Int) {
        _detectedOrder.update { current ->
            current?.let {
                val list = it.items.toMutableList()
                if (index in list.indices) {
                    list.removeAt(index)
                }
                it.copy(items = list)
            }
        }
    }

    fun updateDetectedItemProduct(index: Int, product: Product) {
        _detectedOrder.update { current ->
            current?.let {
                val list = it.items.toMutableList()
                if (index in list.indices) {
                    val original = list[index]
                    list[index] = original.copy(product = product)
                }
                it.copy(items = list)
            }
        }
    }

    fun updateDetectedItemQuantity(index: Int, quantity: Int) {
        _detectedOrder.update { current ->
            current?.let {
                val list = it.items.toMutableList()
                if (index in list.indices) {
                    val original = list[index]
                    list[index] = original.copy(quantity = maxOf(1, quantity))
                }
                it.copy(items = list)
            }
        }
    }

    fun addDetectedItem() {
        val firstProduct = products.value.firstOrNull() ?: return
        _detectedOrder.update { current ->
            current?.let {
                val list = it.items.toMutableList()
                list.add(ActiveOrderItem(firstProduct, 1))
                it.copy(items = list)
            }
        }
    }

    fun cancelDetectedOrder() {
        _detectedOrder.value = null
    }

    fun confirmAndPlaceOrder() {
        val currentOrder = _detectedOrder.value ?: return
        val currentCustomer = currentOrder.customer ?: return
        if (currentOrder.items.isEmpty()) return

        viewModelScope.launch {
            try {
                val total = currentOrder.items.sumOf { it.product.price * it.quantity }
                val order = Order(
                    customer_id = currentCustomer.id,
                    total_amount = total,
                    status = "completed",
                    ai_cost = currentOrder.aiCost
                )
                val orderItemsList = currentOrder.items.map { item ->
                    OrderItem(
                        order_id = 0, // Filled in dynamically by repo transaction
                        product_id = item.product.id,
                        quantity = item.quantity,
                        price = item.product.price
                    )
                }
                repository.createOrder(order, orderItemsList)
                _detectedOrder.value = null
            } catch (e: Exception) {
                _errorMessage.value = "Failed to write order: ${e.message}"
                Log.e("VoiceOrderViewModel", "Error placing order", e)
            }
        }
    }

    // CSV Imports bulk uploads
    fun importProductsCsv(csvText: String) = viewModelScope.launch {
        try {
            _errorMessage.value = null
            _successMessage.value = null
            val records = CsvParser.parseCsv(csvText)
            if (records.isEmpty()) {
                _errorMessage.value = "Product CSV input is empty! Please verify the format."
                return@launch
            }
            val productsList = records.mapNotNull { record ->
                val name = CsvParser.getRecordValue(record, listOf("ProductName", "name", "product_name", "product", "item", "item_name", "ProductName ", "Product Name"))
                val sku = CsvParser.getRecordValue(record, listOf("ProductCode", "sku", "code", "ProductCode ", "Product Code", "Product ID", "id"))
                val priceStr = CsvParser.getRecordValue(record, listOf("price", "Price", "Rate", "cost", "Price ")) ?: "0"
                val cleanedPriceStr = priceStr.replace("$", "").trim()
                val price = cleanedPriceStr.toDoubleOrNull() ?: 0.0
                if (!name.isNullOrBlank()) {
                    Product(name = name.trim(), price = price, sku = sku?.trim() ?: "")
                } else null
            }
            if (productsList.isNotEmpty()) {
                repository.insertProductBulk(productsList)
                _successMessage.value = "Successfully imported ${productsList.size} product catalog items!"
            } else {
                _errorMessage.value = "Failed to parse any products. Check header names: name/ProductName, sku/ProductCode, price!"
            }
        } catch (e: Exception) {
            _errorMessage.value = "Failed to parse Products CSV: ${e.message}"
            Log.e("VoiceOrderViewModel", "Products CSV Exception", e)
        }
    }

    fun importCustomersCsv(csvText: String) = viewModelScope.launch {
        try {
            _errorMessage.value = null
            _successMessage.value = null
            val records = CsvParser.parseCsv(csvText)
            if (records.isEmpty()) {
                _errorMessage.value = "Customer CSV input is empty! Please verify the format."
                return@launch
            }
            val customersList = records.mapNotNull { record ->
                val name = CsvParser.getRecordValue(record, listOf("StockiestName", "name", "CustomerName", "Customer", "Client", "ClientName", "Customer Name", "Client Name"))
                val code = CsvParser.getRecordValue(record, listOf("StockiestCode", "code", "CustomerCode", "Customer Code", "Customer ID", "ID", "CustomerID", "ClientCode", "Client Code"))
                val email = CsvParser.getRecordValue(record, listOf("email", "Email", "mail", "E-mail"))
                val phone = CsvParser.getRecordValue(record, listOf("phone", "Phone", "Contact", "phone_number", "Mobile", "mobile"))
                if (!name.isNullOrBlank()) {
                    Customer(
                        name = name.trim(),
                        email = email?.trim() ?: "",
                        phone = phone?.trim() ?: "",
                        code = code?.trim() ?: ""
                    )
                } else null
            }
            if (customersList.isNotEmpty()) {
                repository.insertCustomerBulk(customersList)
                _successMessage.value = "Successfully imported ${customersList.size} customer accounts!"
            } else {
                _errorMessage.value = "Failed to parse any customers. Check header names: name/StockiestName/CustomerName, code/StockiestCode!"
            }
        } catch (e: Exception) {
            _errorMessage.value = "Failed to parse Customers CSV: ${e.message}"
            Log.e("VoiceOrderViewModel", "Customers CSV Exception", e)
        }
    }

    fun loadSampleData() = viewModelScope.launch {
        _errorMessage.value = null
        _successMessage.value = null
        repository.clearAllData()
        
        val sampleProducts = listOf(
            Product(name = "Apples Fresh", price = 1.99, sku = "APP-01"),
            Product(name = "Organic Bananas", price = 0.89, sku = "BAN-02"),
            Product(name = "Whole Milk 1L", price = 2.49, sku = "MLK-03"),
            Product(name = "Sourdough Bread", price = 3.99, sku = "BRD-04"),
            Product(name = "Coffee Beans 500g", price = 9.99, sku = "COF-05"),
            Product(name = "Organic Yogurt", price = 4.49, sku = "YOG-06")
        )
        val sampleCustomers = listOf(
            Customer(name = "John Doe", email = "john.doe@example.com", phone = "555-0199", code = "C-101"),
            Customer(name = "Alice Smith", email = "alice.smith@example.com", phone = "555-0123", code = "C-102"),
            Customer(name = "Bob Johnson", email = "bob.j@example.com", phone = "555-0145", code = "C-103"),
            Customer(name = "Emily Davis", email = "emily.d@example.com", phone = "555-0177", code = "C-104")
        )
        repository.insertProductBulk(sampleProducts)
        repository.insertCustomerBulk(sampleCustomers)
        _successMessage.value = "Pre-populated sample catalog data (6 products, 4 customers)!"
    }

    fun clearAll() = viewModelScope.launch {
        repository.clearAllData()
        _detectedOrder.value = null
        _errorMessage.value = null
        _successMessage.value = "Successfully cleared catalog database!"
    }

    override fun onCleared() {
        super.onCleared()
        cancelRecording()
    }
}
