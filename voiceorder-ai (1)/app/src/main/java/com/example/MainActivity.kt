package com.example

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Toast
import android.net.Uri
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.data.*
import com.example.ui.VoiceOrderViewModel
import com.example.ui.LoginScreen
import com.example.ui.VoiceOrderViewModel.ActiveOrderItem
import java.text.SimpleDateFormat
import java.util.*

// --- Custom Theme ---
private val EmeraldPrimary = Color(0xFF059669)     // Emerald 600
private val EmeraldSecondary = Color(0xFF10B981)   // Emerald 500
private val EmeraldContainer = Color(0xFFD1FAE5)   // Emerald 100
private val EmeraldOnContainer = Color(0xFF064E3B)  // Emerald 900
private val DarkZinc = Color(0xFF18181B)           // Zinc 900
private val LightZincBg = Color(0xFFF4F4F5)        // Zinc 100
private val SoftShadow = Color(0x0C000000)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            CustomEmeraldTheme {
                MainAppScreen()
            }
        }
    }
}

@Composable
fun CustomEmeraldTheme(content: @Composable () -> Unit) {
    val colors = lightColorScheme(
        primary = EmeraldPrimary,
        secondary = EmeraldSecondary,
        primaryContainer = EmeraldContainer,
        onPrimaryContainer = EmeraldOnContainer,
        background = Color(0xFFF9FAFB),
        surface = Color.White,
        onBackground = DarkZinc,
        onSurface = DarkZinc
    )
    MaterialTheme(
        colorScheme = colors,
        content = content
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainAppScreen() {
    val viewModel: VoiceOrderViewModel = viewModel()
    val isLoggedIn by viewModel.isLoggedIn.collectAsStateWithLifecycle()

    if (!isLoggedIn) {
        LoginScreen(viewModel = viewModel)
    } else {
        val context = LocalContext.current

        // Observe streams from ViewModel
        val products by viewModel.products.collectAsStateWithLifecycle()
        val customers by viewModel.customers.collectAsStateWithLifecycle()
        val orders by viewModel.orders.collectAsStateWithLifecycle()
        val isRecording by viewModel.isRecording.collectAsStateWithLifecycle()
        val isProcessing by viewModel.isProcessing.collectAsStateWithLifecycle()
        val errorMessage by viewModel.errorMessage.collectAsStateWithLifecycle()
        val detectedOrder by viewModel.detectedOrder.collectAsStateWithLifecycle()

        var activeTab by remember { mutableStateOf("voice") } // voice, catalogs, history

        // Runtime Permission Launcher
        var showPermissionAlert by remember { mutableStateOf(false) }
        val recordAudioPermissionLauncher = rememberLauncherForActivityResult(
            contract = ActivityResultContracts.RequestPermission(),
            onResult = { isGranted ->
                if (isGranted) {
                    viewModel.startRecording()
                } else {
                    showPermissionAlert = true
                }
            }
        )

        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .background(EmeraldPrimary, RoundedCornerShape(8.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.PlayArrow,
                                    contentDescription = "Logo Mic",
                                    tint = Color.White,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                            Text(
                                text = "VoiceOrder AI",
                                fontWeight = FontWeight.Bold,
                                fontSize = 20.sp,
                                color = DarkZinc
                            )
                        }
                    },
                    actions = {
                        Row(
                            modifier = Modifier.padding(end = 12.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Badge(containerColor = Color(0xFFE4E4E7)) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Icon(Icons.Default.Build, "Pkg Icon", modifier = Modifier.size(12.dp), tint = Color(0xFF71717A))
                                    Text("${products.size} Products", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF52525B))
                                }
                            }
                            Badge(containerColor = Color(0xFFE4E4E7)) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Icon(Icons.Default.Person, "User Icon", modifier = Modifier.size(12.dp), tint = Color(0xFF71717A))
                                    Text("${customers.size} Customers", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF52525B))
                                }
                            }
                            // Logout action icon
                            IconButton(
                                onClick = { viewModel.logout() },
                                modifier = Modifier.size(36.dp).testTag("logout_button")
                            ) {
                                Icon(
                                    imageVector = Icons.Default.ExitToApp,
                                    contentDescription = "Sign Out",
                                    tint = Color(0xFFEF4444)
                                )
                            }
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
                )
            },
            bottomBar = {
                NavigationBar(containerColor = Color.White) {
                    NavigationBarItem(
                        selected = activeTab == "voice",
                        onClick = { activeTab = "voice" },
                        icon = { Icon(Icons.Default.PlayArrow, "Active Tab") },
                        label = { Text("Voice Entry") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = EmeraldPrimary,
                            selectedTextColor = EmeraldPrimary,
                            indicatorColor = EmeraldContainer
                        )
                    )
                    NavigationBarItem(
                        selected = activeTab == "catalogs",
                        onClick = { activeTab = "catalogs" },
                        icon = { Icon(Icons.Default.List, "Catalog Tab") },
                        label = { Text("Catalog Files") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = EmeraldPrimary,
                            selectedTextColor = EmeraldPrimary,
                            indicatorColor = EmeraldContainer
                        )
                    )
                    NavigationBarItem(
                        selected = activeTab == "history",
                        onClick = { activeTab = "history" },
                        icon = { Icon(Icons.Default.ShoppingCart, "History Tab") },
                        label = { Text("App Orders") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = EmeraldPrimary,
                            selectedTextColor = EmeraldPrimary,
                            indicatorColor = EmeraldContainer
                        )
                    )
                }
            }
        ) { innerPadding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .background(LightZincBg)
            ) {
                // Main views according to active tab
                when (activeTab) {
                    "voice" -> VoiceTabScreen(
                        viewModel = viewModel,
                        products = products,
                        customers = customers,
                        isRecording = isRecording,
                        isProcessing = isProcessing,
                        errorMessage = errorMessage,
                        onRequestPermission = {
                            val permissionCheck = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO)
                            if (permissionCheck == PackageManager.PERMISSION_GRANTED) {
                                viewModel.startRecording()
                            } else {
                                recordAudioPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                            }
                        }
                    )
                    "catalogs" -> CatalogsTabScreen(
                        viewModel = viewModel,
                        products = products,
                        customers = customers
                    )
                    "history" -> HistoryTabScreen(
                        viewModel = viewModel,
                        orders = orders
                    )
                }

                // Confirmed Order Overlay modal if detected
                detectedOrder?.let { activeOrder ->
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color(0x80000000))
                            .clickable(enabled = false) {}, // Intercept taps
                        contentAlignment = Alignment.Center
                    ) {
                        DetectedOrderConfirmationCard(
                            activeOrder = activeOrder,
                            products = products,
                            customers = customers,
                            viewModel = viewModel
                        )
                    }
                }
            }
        }

        if (showPermissionAlert) {
            AlertDialog(
                onDismissRequest = { showPermissionAlert = false },
                title = { Text("Microphone Permission Required") },
                text = { Text("This application converts your orders from your spoken voice. It requires audio permissions to record your input.") },
                confirmButton = {
                    TextButton(onClick = { showPermissionAlert = false }) {
                        Text("OK", color = EmeraldPrimary)
                    }
                }
            )
        }
    }
}

// ==================== TABS IMPLEMENTATION ====================

@Composable
fun VoiceTabScreen(
    viewModel: VoiceOrderViewModel,
    products: List<Product>,
    customers: List<Customer>,
    isRecording: Boolean,
    isProcessing: Boolean,
    errorMessage: String?,
    onRequestPermission: () -> Unit
) {
    var txtCommand by remember { mutableStateOf("") }
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Top
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            shape = RoundedCornerShape(20.dp),
            border = BorderStroke(1.dp, Color(0xFFE4E4E7))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = "Tap to Speak Order",
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                    color = DarkZinc
                )
                Text(
                    text = if (isRecording) "Listening closely... tap red light to finish" else "Click the microphone button and tell the AI what you want to order.",
                    fontSize = 13.sp,
                    color = Color(0xFF71717A),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 8.dp)
                )

                Spacer(modifier = Modifier.height(10.dp))

                // Microphone pulse indicator
                val pulseScale by rememberInfiniteTransition(label = "pulse").animateFloat(
                    initialValue = 1.0f,
                    targetValue = if (isRecording) 1.25f else 1.0f,
                    animationSpec = infiniteRepeatable(
                        animation = tween(1200, easing = FastOutSlowInEasing),
                        repeatMode = RepeatMode.Reverse
                    ),
                    label = "pulse"
                )

                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.padding(20.dp)
                ) {
                    if (isRecording) {
                        Box(
                            modifier = Modifier
                                .size(130.dp)
                                .background(Color(0x2efb7185), CircleShape)
                        )
                        Box(
                            modifier = Modifier
                                .size(105.dp)
                                .background(Color(0xFFFECDD3), CircleShape)
                        )
                    }

                    Box(
                        modifier = Modifier
                            .size(76.dp)
                            .background(
                                if (isRecording) Color(0xFFEF4444) else EmeraldPrimary,
                                CircleShape
                            )
                            .clickable(enabled = !isProcessing) {
                                if (isRecording) {
                                    viewModel.stopRecordingAndProcess()
                                } else {
                                    onRequestPermission()
                                }
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        if (isProcessing) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(28.dp))
                        } else {
                            Icon(
                                imageVector = if (isRecording) Icons.Default.Stop else Icons.Default.Mic,
                                contentDescription = "Recording mic toggle",
                                tint = Color.White,
                                modifier = Modifier.size(32.dp)
                            )
                        }
                    }
                }

                Text(
                    text = when {
                        isProcessing -> "Processing Voice on Gemini..."
                        isRecording -> "REC"
                        else -> "IDLE"
                    },
                    fontWeight = FontWeight.Bold,
                    fontSize = 11.sp,
                    color = if (isRecording) Color(0xFFEF4444) else Color(0xFF71717A),
                    letterSpacing = 1.sp
                )

                if (!isRecording && !isProcessing) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Button(
                        onClick = {
                            val prompts = listOf(
                                "Hey Gemini, create an order for Alice Smith including three sourdough breads and one pack of coffee beans please.",
                                "Hello! I need to place an order for Bob Johnson for two whole milk bottles and one organic yogurt.",
                                "Urgent order for Emily Davis: three apples fresh"
                            )
                            val randomPrompt = prompts.random()
                            txtCommand = randomPrompt
                            viewModel.processTextCommand(randomPrompt)
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFF4F4F5),
                            contentColor = DarkZinc
                        ),
                        border = BorderStroke(1.dp, Color(0xFFE4E4E7)),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.PlayArrow,
                            contentDescription = "Simulate Speak Icon",
                            tint = DarkZinc,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Simulate Spoken Command",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = DarkZinc
                        )
                    }
                }

                if (isRecording) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.padding(top = 10.dp)
                    ) {
                        Button(
                            onClick = { viewModel.cancelRecording() },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444)),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Text("Discard", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        // Error message card
        errorMessage?.let { error ->
            Card(
                modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF2F2)),
                border = BorderStroke(1.dp, Color(0xFFFCA5A5)),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = "Alert Error",
                        tint = Color(0xFFEF4444)
                    )
                    Text(
                        text = error,
                        color = Color(0xFF991B1B),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }

        // Direct Text Command Input Section (Simulator Helper)
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            shape = RoundedCornerShape(20.dp),
            border = BorderStroke(1.dp, Color(0xFFE4E4E7))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "⌨ Text Command (Simulator Fallback)",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = DarkZinc
                )
                
                Text(
                    text = "If your streaming simulator's microphone has trouble capturing audio, you can type, copy-paste, or click an example command below to run the AI's matching logic directly:",
                    fontSize = 12.sp,
                    color = Color(0xFF71717A)
                )

                OutlinedTextField(
                    value = txtCommand,
                    onValueChange = { txtCommand = it },
                    placeholder = { Text("E.g., I want to place an order of 3 Sourdough Breads and 1 Coffee Beans for Alice Smith", fontSize = 13.sp) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = EmeraldPrimary,
                        unfocusedBorderColor = Color(0xFFE4E4E7)
                    )
                )

                Button(
                    onClick = {
                        if (txtCommand.isNotBlank() && !isProcessing) {
                            viewModel.processTextCommand(txtCommand)
                        }
                    },
                    enabled = txtCommand.isNotBlank() && !isProcessing,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text(
                        text = if (isProcessing) "AI Processing..." else "Process Instruction",
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                }

                Text(
                    text = "⏱ Quick Test Commands (Tap to parse):",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF71717A),
                    modifier = Modifier.padding(top = 4.dp)
                )

                val suggestions = listOf(
                    "I want to place an order of 3 Sourdough Breads and 1 Coffee Beans for Alice Smith",
                    "Place an order of 2 Whole Milk 1L and 1 Organic Yogurt for Bob Johnson",
                    "Quick order: Emily Davis wants 3 Apples Fresh"
                )

                Column(
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    suggestions.forEach { suggestion ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable(enabled = !isProcessing) {
                                    txtCommand = suggestion
                                    viewModel.processTextCommand(suggestion)
                                },
                            colors = CardDefaults.cardColors(containerColor = Color(0xFFF4F4F5)),
                            shape = RoundedCornerShape(8.dp),
                            border = BorderStroke(1.dp, Color(0xFFE4E4E7))
                        ) {
                            Text(
                                text = suggestion,
                                fontSize = 11.sp,
                                color = DarkZinc,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                            )
                        }
                    }
                }
            }
        }

        // Speak Instruction Prompt Card helper
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFFECFDF5)),
            border = BorderStroke(1.dp, Color(0xFFA7F3D0)),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = "💡 Voice Examples",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = EmeraldOnContainer
                )
                Text(
                    text = "• \"Place an order of 15 Apples Fresh and 3 Whole Milk for Alice Smith\"",
                    fontSize = 11.sp,
                    color = EmeraldOnContainer
                )
                Text(
                    text = "• \"Create a new order for Emily Davis: 1 Organic Bananas, 2 sourdough bread and some yogurt\"",
                    fontSize = 11.sp,
                    color = EmeraldOnContainer
                )
            }
        }
    }
}

@Composable
fun CatalogsTabScreen(
    viewModel: VoiceOrderViewModel,
    products: List<Product>,
    customers: List<Customer>
) {
    var rawProductsText by remember { mutableStateOf("") }
    var rawCustomersText by remember { mutableStateOf("") }
    var activeCsvMode by remember { mutableStateOf("products") } // products, customers
    val scrollState = rememberScrollState()
    val context = LocalContext.current
    
    val successMessage by viewModel.successMessage.collectAsStateWithLifecycle()
    val errorMessage by viewModel.errorMessage.collectAsStateWithLifecycle()

    // File picker launcher
    val csvPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            try {
                context.contentResolver.openInputStream(uri)?.use { inputStream ->
                    val resolvedText = inputStream.bufferedReader().use { reader -> reader.readText() }
                    if (resolvedText.isNotBlank()) {
                        if (activeCsvMode == "products") {
                            viewModel.importProductsCsv(resolvedText)
                        } else {
                            viewModel.importCustomersCsv(resolvedText)
                        }
                    } else {
                        viewModel.setErrorMessage("The selected file is empty!")
                    }
                }
            } catch (e: Exception) {
                viewModel.setErrorMessage("Failed to read selected file: ${e.localizedMessage}")
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(scrollState),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Status Alerts (Success / Error Banners for immediate visual feedback)
        if (successMessage != null || errorMessage != null) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = if (successMessage != null) Color(0xFFECFDF5) else Color(0xFFFEF2F2)
                ),
                border = BorderStroke(
                    1.dp,
                    if (successMessage != null) Color(0xFFA7F3D0) else Color(0xFFFCA5A5)
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = if (successMessage != null) Icons.Default.CheckCircle else Icons.Default.Warning,
                        contentDescription = "Status Icon",
                        tint = if (successMessage != null) Color(0xFF10B981) else Color(0xFFEF4444)
                    )
                    Text(
                        text = successMessage ?: errorMessage ?: "",
                        color = if (successMessage != null) Color(0xFF065F46) else Color(0xFF991B1B),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.weight(1f)
                    )
                    IconButton(
                        onClick = {
                            viewModel.clearSuccessMessage()
                            viewModel.setErrorMessage(null)
                        },
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Dismiss",
                            tint = if (successMessage != null) Color(0xFF047857) else Color(0xFFB91C1C),
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
        }

        // Hero Preset Data Launcher Box
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = EmeraldContainer),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = "⚡ Instant Testing Setup",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = EmeraldOnContainer
                )
                Text(
                    text = "Instantly pre-populate products, customer names, codes, pricing, and details in one tap to try your voice transcription right away!",
                    fontSize = 12.sp,
                    color = EmeraldOnContainer
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = { viewModel.loadSampleData() },
                        colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary)
                    ) {
                        Text("Load Sample Store Data", fontWeight = FontWeight.Bold)
                    }
                    OutlinedButton(
                        onClick = { viewModel.clearAll() },
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFEF4444)),
                        border = BorderStroke(1.dp, Color(0xFFFCA5A5))
                    ) {
                        Text("Clear All DB")
                    }
                }
            }
        }

        // CSV uploading console card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            border = BorderStroke(1.dp, Color(0xFFE4E4E7)),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "Upload Store Catalog Files",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = DarkZinc
                )

                TabRow(
                    selectedTabIndex = if (activeCsvMode == "products") 0 else 1,
                    containerColor = Color.Transparent,
                    contentColor = EmeraldPrimary
                ) {
                    Tab(
                        selected = activeCsvMode == "products",
                        onClick = { activeCsvMode = "products" },
                        text = { Text("Products CSV") }
                    )
                    Tab(
                        selected = activeCsvMode == "customers",
                        onClick = { activeCsvMode = "customers" },
                        text = { Text("Customers CSV") }
                    )
                }

                Text(
                    text = if (activeCsvMode == "products") {
                        "Paste a comma-separated row text. Headers: ProductCode,ProductName,price"
                    } else {
                        "Paste a comma-separated row text. Headers: CustomerCode,CustomerName"
                    },
                    fontSize = 11.sp,
                    color = Color(0xFF71717A)
                )

                OutlinedTextField(
                    value = if (activeCsvMode == "products") rawProductsText else rawCustomersText,
                    onValueChange = {
                        if (activeCsvMode == "products") {
                            rawProductsText = it
                        } else {
                            rawCustomersText = it
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(115.dp),
                    shape = RoundedCornerShape(10.dp),
                    textStyle = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 11.sp),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Ascii,
                        autoCorrect = false
                    ),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = EmeraldPrimary,
                        unfocusedBorderColor = Color(0xFFE4E4E7)
                    ),
                    placeholder = {
                        Text(
                            text = if (activeCsvMode == "products") {
                                "💡 Paste product CSV text here...\n\nExample:\nProductCode,ProductName,price\nCOF-10,Premium Bean Coffee,8.45"
                            } else {
                                "💡 Paste customer CSV text here...\n\nExample:\nCustomerCode,CustomerName\nC-105,Sarah Conner"
                            },
                            color = Color.Gray.copy(alpha = 0.5f),
                            fontSize = 11.sp
                        )
                    }
                )

                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = {
                            if (activeCsvMode == "products") {
                                viewModel.importProductsCsv(rawProductsText)
                                rawProductsText = ""
                            } else {
                                viewModel.importCustomersCsv(rawCustomersText)
                                rawCustomersText = ""
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary)
                    ) {
                        Text("Process & Save")
                    }

                    // Demo copy helper buttons
                    TextButton(
                        onClick = {
                            if (activeCsvMode == "products") {
                                rawProductsText = "ProductCode,ProductName,price\nCHZ-99,Gouda Cheese Wheels,12.50\nTEA-40,English Earl Grey Tea,4.10"
                            } else {
                                rawCustomersText = "CustomerCode,CustomerName\nC-201,John Connor"
                            }
                        }
                    ) {
                        Text("Use Template text")
                    }
                }

                HorizontalDivider(color = Color(0xFFF4F4F5), thickness = 1.dp)

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Share,
                        contentDescription = "Upload CSV",
                        tint = EmeraldPrimary,
                        modifier = Modifier.size(20.dp)
                    )
                    Column {
                        Text(
                            text = "Or load standard CSV file directly:",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = DarkZinc
                        )
                        Text(
                            text = "Select a .csv or .txt file containing header rows",
                            fontSize = 11.sp,
                            color = Color(0xFF71717A)
                        )
                    }
                }

                Button(
                    onClick = {
                        csvPickerLauncher.launch("*/*")
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF4F4F8), contentColor = DarkZinc),
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, Color(0xFFE4E4E7))
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Pick CSV File",
                        tint = EmeraldPrimary,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (activeCsvMode == "products") "Select Products CSV File" else "Select Customers CSV File",
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                }
            }
        }

        // Live Catalogs Summary View Cards
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            border = BorderStroke(1.dp, Color(0xFFE4E4E7)),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "Catalog Inventory",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = DarkZinc
                )

                Text(
                    text = "Showing imported items in your database:",
                    fontSize = 12.sp,
                    color = Color(0xFF71717A)
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Card(
                        modifier = Modifier.weight(1f),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFAFAFA)),
                        border = BorderStroke(1.dp, Color(0xFFF4F4F5))
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text("Products Live", fontSize = 11.sp, color = Color(0xFF71717A))
                            Text("${products.size}", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = DarkZinc)
                            Spacer(modifier = Modifier.height(4.dp))
                            products.take(3).forEach {
                                Text("• ${it.name} (₹${it.price})", fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                        }
                    }

                    Card(
                        modifier = Modifier.weight(1f),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFAFAFA)),
                        border = BorderStroke(1.dp, Color(0xFFF4F4F5))
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text("Customers Live", fontSize = 11.sp, color = Color(0xFF71717A))
                            Text("${customers.size}", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = DarkZinc)
                            Spacer(modifier = Modifier.height(4.dp))
                            customers.take(3).forEach {
                                Text("• ${it.name} (${it.code ?: "No Code"})", fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun HistoryTabScreen(
    viewModel: VoiceOrderViewModel,
    orders: List<OrderWithCustomer>
) {
    if (orders.isEmpty()) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.ShoppingCart,
                    contentDescription = "No Orders Cart Icon",
                    tint = Color(0xFFD4D4D8),
                    modifier = Modifier.size(64.dp)
                )
                Text(
                    text = "No Orders Placed Yet",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = Color(0xFF71717A)
                )
                Text(
                    text = "Process orders by voice or upload sample catalog items to see live transactions.",
                    fontSize = 12.sp,
                    color = Color(0xFFA1A1AA),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 24.dp)
                )
            }
        }
    } else {
        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            item {
                Text(
                    text = "Transaction Records",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = DarkZinc,
                    modifier = Modifier.padding(bottom = 4.dp)
                )
            }

            items(orders) { order ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, Color(0xFFE4E4E7)),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "ORDER ID: #${order.id.toString().padStart(4, '0')}",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp,
                                    fontFamily = FontFamily.Monospace,
                                    color = Color(0xFF71717A)
                                )
                                Text(
                                    text = order.customer_name ?: "Unknown Customer",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    color = DarkZinc
                                )
                                if (order.customer_code != null) {
                                    Text(
                                        text = "CODE: ${order.customer_code}",
                                        fontSize = 10.sp,
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFFA1A1AA)
                                    )
                                }
                            }

                            Box(
                                modifier = Modifier
                                    .background(Color(0xFFD1FAE5), RoundedCornerShape(100.dp))
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = "COMPLETED",
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF065F46)
                                )
                            }
                        }

                        Divider(color = Color(0xFFF4F4F5))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                val sdf = SimpleDateFormat("MMM d, yyyy", Locale.US)
                                val dateStr = sdf.format(Date(order.created_at))
                                Text("Date: $dateStr", fontSize = 11.sp, color = Color(0xFF71717A))
                                
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Icon(Icons.Default.Info, "AI Chip Cost Icon", modifier = Modifier.size(10.dp), tint = Color(0xFF71717A))
                                    Text(
                                        text = "AI cost: $${String.format(Locale.US, "%.6f", order.ai_cost)}",
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 10.sp,
                                        color = Color(0xFF71717A)
                                    )
                                }
                            }

                            Text(
                                text = "₹${String.format(Locale.US, "%.2f", order.total_amount)}",
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp,
                                color = EmeraldPrimary
                            )
                        }
                    }
                }
            }
        }
    }
}

// ==================== DIALOG ORDER CONFIRMATION SCREEN ====================

@Composable
fun DetectedOrderConfirmationCard(
    activeOrder: VoiceOrderViewModel.ActiveOrderState,
    products: List<Product>,
    customers: List<Customer>,
    viewModel: VoiceOrderViewModel
) {
    var customerExpanded by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
            .wrapContentHeight(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(2.dp, EmeraldPrimary)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth()
        ) {
            // Emerald Banner header
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(EmeraldPrimary)
                    .padding(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = "Success tick icon",
                            tint = Color.White
                        )
                        Text(
                            text = "Order Captured",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = Color.White
                        )
                    }
                    IconButton(
                        onClick = { viewModel.cancelDetectedOrder() },
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Close overlay context",
                            tint = Color.White
                        )
                    }
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Transcription Transcript Box
                activeOrder.originalTranscript?.let { transcript ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFFF9FAFB), RoundedCornerShape(10.dp))
                            .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(10.dp))
                            .padding(12.dp)
                    ) {
                        Text(
                            text = "AI HEARD / PARSED",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF6B7280),
                            letterSpacing = 1.sp,
                            modifier = Modifier.padding(bottom = 4.dp)
                        )
                        Text(
                            text = "\"$transcript\"",
                            fontSize = 13.sp,
                            fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                            color = DarkZinc,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }

                // Select customer
                Column {
                    Text(
                        text = "CUSTOMER",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF71717A),
                        letterSpacing = 1.sp,
                        modifier = Modifier.padding(bottom = 6.dp)
                    )

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFFFAFAFA), RoundedCornerShape(8.dp))
                            .border(
                                1.dp,
                                if (activeOrder.customer == null) Color(0xFFFCA5A5) else Color(0xFFE4E4E7),
                                RoundedCornerShape(8.dp)
                            )
                            .clickable { customerExpanded = true }
                            .padding(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = activeOrder.customer?.name ?: "-- Select Customer --",
                                fontWeight = FontWeight.Bold,
                                color = if (activeOrder.customer == null) Color(0xFFEF4444) else DarkZinc,
                                fontSize = 14.sp
                            )
                            Icon(Icons.Default.ArrowDropDown, "dropdown", tint = Color(0xFF71717A))
                        }

                        DropdownMenu(
                            expanded = customerExpanded,
                            onDismissRequest = { customerExpanded = false },
                            modifier = Modifier.fillMaxWidth(0.8f)
                        ) {
                            customers.forEach { customer ->
                                DropdownMenuItem(
                                    text = { Text("${customer.name} (${customer.code ?: "No Code"})") },
                                    onClick = {
                                        viewModel.selectDetectedCustomer(customer)
                                        customerExpanded = false
                                    }
                                )
                            }
                        }
                    }

                    if (activeOrder.customer == null) {
                        Text(
                            text = "⚠ Please register/select a customer to continue",
                            color = Color(0xFFEF4444),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                }

                // AI summary row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text("AI PROCESSING COST", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color(0xFF71717A))
                        Text(
                            text = "$${String.format(Locale.US, "%.6f", activeOrder.aiCost)}",
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            color = EmeraldPrimary
                        )
                    }

                    Column(horizontalAlignment = Alignment.End) {
                        Text("ITEMS", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color(0xFF71717A))
                        Text(
                            text = "${activeOrder.items.sumOf { it.quantity }} units",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = DarkZinc
                        )
                    }
                }

                Divider(color = Color(0xFFF4F4F5))

                // Table of matched order items
                Text(
                    text = "SPECIFIED ORDER ITEMS",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF71717A),
                    letterSpacing = 1.sp
                )

                // List of items in the captured order builder
                activeOrder.items.forEachIndexed { idx, item ->
                    var itemProductExpanded by remember { mutableStateOf(false) }

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFAFAFA)),
                        border = BorderStroke(
                            1.dp,
                            if (item.suggestions.size > 1) Color(0xFFFCD34D) else Color(0xFFE4E4E7) // Yellow outline for ambiguity
                        )
                    ) {
                        Column(
                            modifier = Modifier.padding(10.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                // Product selection dropdown column
                                Box(
                                    modifier = Modifier
                                        .weight(0.6f)
                                        .background(Color.White, RoundedCornerShape(6.dp))
                                        .border(1.dp, Color(0xFFE4E4E7), RoundedCornerShape(6.dp))
                                        .clickable { itemProductExpanded = true }
                                        .padding(horizontal = 8.dp, vertical = 6.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = item.product.name,
                                            fontWeight = FontWeight.SemiBold,
                                            fontSize = 12.sp,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Icon(Icons.Default.ArrowDropDown, "drop_prod", modifier = Modifier.size(16.dp))
                                    }

                                    DropdownMenu(
                                        expanded = itemProductExpanded,
                                        onDismissRequest = { itemProductExpanded = false }
                                    ) {
                                        products.forEach { p ->
                                            DropdownMenuItem(
                                                text = { Text("${p.name} (₹${p.price})") },
                                                onClick = {
                                                    viewModel.updateDetectedItemProduct(idx, p)
                                                    itemProductExpanded = false
                                                }
                                            )
                                        }
                                    }
                                }

                                // Quantity +/- controls
                                Row(
                                    modifier = Modifier
                                        .weight(0.3f)
                                        .padding(horizontal = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.Center
                                ) {
                                    IconButton(
                                        onClick = { viewModel.updateDetectedItemQuantity(idx, item.quantity - 1) },
                                        modifier = Modifier.size(24.dp)
                                    ) {
                                        Icon(Icons.Default.KeyboardArrowLeft, "minus", modifier = Modifier.size(16.dp))
                                    }
                                    Text(
                                        text = "${item.quantity}",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp,
                                        modifier = Modifier.padding(horizontal = 4.dp)
                                    )
                                    IconButton(
                                        onClick = { viewModel.updateDetectedItemQuantity(idx, item.quantity + 1) },
                                        modifier = Modifier.size(24.dp)
                                    ) {
                                        Icon(Icons.Default.Add, "plus", modifier = Modifier.size(16.dp))
                                    }
                                }

                                // Delete row button
                                IconButton(
                                    onClick = { viewModel.removeDetectedItem(idx) },
                                    modifier = Modifier
                                        .weight(0.1f)
                                        .size(24.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Delete,
                                        contentDescription = "Delete item line",
                                        tint = Color(0xFFEF4444),
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            }

                            // Suggestions chips for ambiguity - Match PC exact behavior!
                            if (item.suggestions.size > 1) {
                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text(
                                        text = "💡 SELECT CORRECT MATCH (AMBIGUOUS):",
                                        fontSize = 9.sp,
                                        color = Color(0xFFB45309),
                                        fontWeight = FontWeight.Bold
                                    )
                                    Row(
                                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                                    ) {
                                        item.suggestions.forEach { p ->
                                            val isSelected = p.id == item.product.id
                                            Box(
                                                modifier = Modifier
                                                    .background(
                                                        if (isSelected) EmeraldPrimary else Color.White,
                                                        RoundedCornerShape(6.dp)
                                                    )
                                                    .border(
                                                        1.dp,
                                                        if (isSelected) EmeraldPrimary else Color(0xFFFCD34D),
                                                        RoundedCornerShape(6.dp)
                                                    )
                                                    .clickable { viewModel.updateDetectedItemProduct(idx, p) }
                                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                                            ) {
                                                Text(
                                                    text = "${p.name} ⭐",
                                                    color = if (isSelected) Color.White else Color(0xFFB45309),
                                                    fontSize = 9.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                        }
                                    }
                                }
                            }

                            // Individual row total
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.End
                            ) {
                                Text(
                                    text = "₹${String.format(Locale.US, "%.2f", item.product.price)} x ${item.quantity} = ₹${String.format(Locale.US, "%.2f", item.product.price * item.quantity)}",
                                    fontSize = 11.sp,
                                    color = Color(0xFF71717A),
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }
                }

                // Add item button row
                Button(
                    onClick = { viewModel.addDetectedItem() },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF4F4F5), contentColor = DarkZinc),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth(),
                    contentPadding = PaddingValues(vertical = 8.dp)
                ) {
                    Icon(Icons.Default.Add, "add row icon", modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Add Row Item", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }

                Spacer(modifier = Modifier.height(6.dp))

                // Place order action buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = { viewModel.confirmAndPlaceOrder() },
                        enabled = activeOrder.customer != null && activeOrder.items.isNotEmpty(),
                        colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp)
                    ) {
                        Text("Confirm & Create Order", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }

                    OutlinedButton(
                        onClick = { viewModel.cancelDetectedOrder() },
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, Color(0xFFE4E4E7)),
                        modifier = Modifier
                            .weight(0.4f)
                            .height(48.dp)
                    ) {
                        Text("Cancel", color = Color(0xFF52525B), fontSize = 13.sp)
                    }
                }
            }
        }
    }
}
