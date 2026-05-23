package com.example.ui

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.BuildConfig
import com.example.data.AuthService

// Styling matching MainAppScreen
private val EmeraldPrimary = Color(0xFF059669)     // Emerald 600
private val EmeraldSecondary = Color(0xFF10B981)   // Emerald 500
private val EmeraldContainer = Color(0xFFD1FAE5)   // Emerald 100
private val EmeraldOnContainer = Color(0xFF064E3B)  // Emerald 900
private val DarkZinc = Color(0xFF18181B)           // Zinc 900
private val SoftShadow = Color(0x0C000000)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    viewModel: VoiceOrderViewModel,
    modifier: Modifier = Modifier
) {
    val isAuthenticating by viewModel.isAuthenticating.collectAsStateWithLifecycle()
    val loginError by viewModel.loginError.collectAsStateWithLifecycle()

    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isPasswordVisible by remember { mutableStateOf(false) }

    val focusManager = LocalFocusManager.current
    val scrollState = rememberScrollState()

    // Determine config/mock setup status dynamically
    val configApiUrl = BuildConfig.LOGIN_API_URL
    val isMockMode = AuthService.USE_MOCK_AUTH

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = Color(0xFFF9FAFB) // Warm organic background
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .imePadding()
                .verticalScroll(scrollState),
            contentAlignment = Alignment.Center
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp)
                    .widthIn(max = 450.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                // Mic Logo representation matching VoiceOrder AI header
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .background(EmeraldPrimary, RoundedCornerShape(16.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Mic,
                        contentDescription = "VoiceOrder AI Mic Logo",
                        tint = Color.White,
                        modifier = Modifier.size(36.dp)
                    )
                }

                // Welcome header typography with ample spacing
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "VoiceOrder AI login",
                        fontWeight = FontWeight.Bold,
                        fontSize = 26.sp,
                        color = DarkZinc
                    )
                    Text(
                        text = "Enter stock manager or sales credentials to get started",
                        fontSize = 13.sp,
                        color = Color(0xFF71717A),
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(horizontal = 16.dp)
                    )
                }

                // Config and Active Server Status Indicator Banner card
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("api_config_card"),
                    colors = CardDefaults.cardColors(
                        containerColor = if (isMockMode) Color(0xFFECFDF5) else Color(0xFFEFF6FF)
                    ),
                    border = BorderStroke(
                        width = 1.dp,
                        color = if (isMockMode) Color(0xFFA7F3D0) else Color(0xFFBFDBFE)
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .background(
                                    if (isMockMode) Color(0xFFD1FAE5) else Color(0xFFDBEAFE),
                                    RoundedCornerShape(8.dp)
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = if (isMockMode) Icons.Default.CheckCircle else Icons.Default.Build,
                                contentDescription = "Active connection mode",
                                tint = if (isMockMode) EmeraldPrimary else Color(0xFF2563EB),
                                modifier = Modifier.size(18.dp)
                            )
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = if (isMockMode) "Active Mode: Local Seed Accounts" else "Active Mode: Central Network Login",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isMockMode) Color(0xFF065F46) else Color(0xFF1E40AF)
                            )
                            Text(
                                text = if (isMockMode) "Using predefined prototype accounts. Easy to toggle inside AuthService.kt when ready." else "Connected Server: $configApiUrl",
                                fontSize = 10.sp,
                                color = if (isMockMode) Color(0xFF047857) else Color(0xFF3B82F6),
                                lineHeight = 13.sp
                            )
                        }
                    }
                }

                // Login card form
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(20.dp),
                    border = BorderStroke(1.dp, Color(0xFFE4E4E7))
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Username Input field
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                text = "Username",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = DarkZinc
                            )
                            OutlinedTextField(
                                value = username,
                                onValueChange = { username = it },
                                placeholder = { Text("e.g. admin or sales_user", fontSize = 14.sp) },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .testTag("username_input"),
                                shape = RoundedCornerShape(10.dp),
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(
                                    keyboardType = KeyboardType.Text,
                                    imeAction = ImeAction.Next
                                ),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = EmeraldPrimary,
                                    unfocusedBorderColor = Color(0xFFE4E4E7)
                                )
                            )
                        }

                        // Password Input Field
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                text = "Password",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = DarkZinc
                            )
                            OutlinedTextField(
                                value = password,
                                onValueChange = { password = it },
                                placeholder = { Text("••••••••", fontSize = 14.sp) },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .testTag("password_input"),
                                shape = RoundedCornerShape(10.dp),
                                singleLine = true,
                                visualTransformation = if (isPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                                keyboardOptions = KeyboardOptions(
                                    keyboardType = KeyboardType.Password,
                                    imeAction = ImeAction.Done
                                ),
                                keyboardActions = KeyboardActions(
                                    onDone = {
                                        focusManager.clearFocus()
                                        if (username.isNotBlank() && password.isNotBlank() && !isAuthenticating) {
                                            viewModel.loginWithUsername(username, password)
                                        }
                                    }
                                ),
                                trailingIcon = {
                                    IconButton(
                                        onClick = { isPasswordVisible = !isPasswordVisible },
                                        modifier = Modifier.minimumInteractiveComponentSize()
                                    ) {
                                        Icon(
                                            imageVector = if (isPasswordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                            contentDescription = if (isPasswordVisible) "Hide password" else "Show password",
                                            tint = Color(0xFF71717A)
                                        )
                                    }
                                },
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = EmeraldPrimary,
                                    unfocusedBorderColor = Color(0xFFE4E4E7)
                                )
                            )
                        }

                        // Action main submit button (minimum touch target 48dp conformant)
                        Button(
                            onClick = {
                                focusManager.clearFocus()
                                viewModel.loginWithUsername(username, password)
                            },
                            enabled = username.isNotBlank() && password.isNotBlank() && !isAuthenticating,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp)
                                .testTag("login_button"),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = EmeraldPrimary,
                                disabledContainerColor = Color(0xFFE4E4E7),
                                disabledContentColor = Color(0xFFA1A1AA)
                            )
                        ) {
                            if (isAuthenticating) {
                                CircularProgressIndicator(
                                    color = Color.White,
                                    modifier = Modifier.size(20.dp),
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.Center
                                ) {
                                    Text("Sign In", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Icon(
                                        imageVector = Icons.Default.PlayArrow,
                                        contentDescription = "Forward submit",
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            }
                        }
                    }
                }

                // Error State Callout Alert banner if exists
                AnimatedVisibility(
                    visible = loginError != null,
                    enter = fadeIn() + expandVertically(),
                    exit = fadeOut() + shrinkVertically()
                ) {
                    loginError?.let { err ->
                        Card(
                            modifier = Modifier.fillMaxWidth().testTag("error_card"),
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
                                    contentDescription = "Alert Error Indicator",
                                    tint = Color(0xFFEF4444)
                                )
                                Text(
                                    text = err,
                                    color = Color(0xFF991B1B),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }
                }

                // Easy Auto-fill Prototype helper to save user typing on Emulator
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFF4F4F5)),
                    border = BorderStroke(1.dp, Color(0xFFE4E4E7)),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        horizontalAlignment = Alignment.Start
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Lock,
                                contentDescription = "Demo key indicator",
                                tint = Color(0xFF71717A),
                                modifier = Modifier.size(14.dp)
                            )
                            Text(
                                text = "Instant Mock Test Accounts",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 12.sp,
                                color = DarkZinc
                            )
                        }
                        Text(
                            text = if (isMockMode) {
                                "Tap any database seed account below to auto-fill username and password for testing:"
                            } else {
                                "The app is currently configured to route live API login. Seed accounts will fallback if mock is re-enabled."
                            },
                            fontSize = 11.sp,
                            color = Color(0xFF71717A),
                            lineHeight = 14.sp
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Button(
                                onClick = {
                                    username = "admin"
                                    password = "admin123"
                                },
                                modifier = Modifier.weight(1f).height(38.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color.White,
                                    contentColor = EmeraldOnContainer
                                ),
                                border = BorderStroke(1.dp, Color(0xFFD1FAE5)),
                                contentPadding = PaddingValues(horizontal = 4.dp),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("admin", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }

                            Button(
                                onClick = {
                                    username = "sales_user"
                                    password = "sales123"
                                },
                                modifier = Modifier.weight(1f).height(38.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color.White,
                                    contentColor = Color(0xFF3B82F6)
                                ),
                                border = BorderStroke(1.dp, Color(0xFFDBEAFE)),
                                contentPadding = PaddingValues(horizontal = 4.dp),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("sales_user", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }

                            Button(
                                onClick = {
                                    username = "test_user"
                                    password = "test123"
                                },
                                modifier = Modifier.weight(1f).height(38.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color.White,
                                    contentColor = Color(0xFF71717A)
                                ),
                                border = BorderStroke(1.dp, Color(0xFFE4E4E7)),
                                contentPadding = PaddingValues(horizontal = 4.dp),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("test_user", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}
