package com.example.data

import android.util.Log
import com.example.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class AuthService {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    companion object {
        // TOGGLE THIS FLAG TO SWITCH BETWEEN LOCAL SEED DATA AND REAL SYSTEM API 
        const val USE_MOCK_AUTH = true

        // SEED DATA FOR LOCAL PLAYGROUND OR SIMULATION (Username to Password matching)
        val SEED_ACCOUNTS = mapOf(
            "admin" to "admin123",
            "sales_user" to "sales123",
            "test_user" to "test123"
        )
    }

    /**
     * Attempts to login user with username and password.
     * Easy to switch between local seed simulation and live REST API connections.
     * Returns Result<String> with token if successful, or error detail on failure.
     */
    suspend fun login(username: String, password: String): Result<String> = withContext(Dispatchers.IO) {
        val normalizedUsername = username.trim().lowercase()

        if (USE_MOCK_AUTH) {
            // Simulated network latency
            delay(1000)

            val correctPassword = SEED_ACCOUNTS[normalizedUsername]
            return@withContext if (correctPassword != null && correctPassword == password) {
                Log.d("AuthService", "Local Mock authentication successful for $normalizedUsername")
                Result.success("mock_token_${normalizedUsername}_${System.currentTimeMillis()}")
            } else {
                Log.d("AuthService", "Local Mock authentication failed for $normalizedUsername")
                Result.failure(Exception("Incorrect username or password. Available: 'admin' (pass: 'admin123'), 'sales_user' (pass: 'sales123')"))
            }
        }

        // --- REAL LIVE BACKEND API CALL ---
        // Change USE_MOCK_AUTH to false above to route requests here
        try {
            // Retrieve LOGIN_API_URL from local system build configuration
            val rawUrl = BuildConfig.LOGIN_API_URL
            val baseUrl = if (rawUrl.endsWith("/")) rawUrl.substring(0, rawUrl.length - 1) else rawUrl
            val url = "$baseUrl/login"

            val jsonBody = JSONObject().apply {
                put("username", normalizedUsername)
                put("password", password)
            }

            val mediaType = "application/json; charset=utf-8".toMediaType()
            val requestBody = jsonBody.toString().toRequestBody(mediaType)

            val request = Request.Builder()
                .url(url)
                .post(requestBody)
                .build()

            Log.d("AuthService", "Sending real live auth request to URL: $url")
            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                Log.d("AuthService", "Real Auth response code: ${response.code}")
                
                if (response.isSuccessful) {
                    val jsonResponse = JSONObject(responseStr)
                    val token = jsonResponse.optString("token", "")
                    if (token.isNotEmpty()) {
                        Result.success(token)
                    } else {
                        Result.failure(Exception("Successful login but missing session token from API server response."))
                    }
                } else {
                    val errorMessage = try {
                        JSONObject(responseStr).optString("error", "Invalid username or password.")
                    } catch (e: Exception) {
                        "API request failed with code: ${response.code}"
                    }
                    Result.failure(Exception(errorMessage))
                }
            }
        } catch (e: Exception) {
            Log.e("AuthService", "Live Network API call failed during login operation", e)
            Result.failure(Exception("Network error: Please check your internet connection and verify LOGIN_API_URL in CONFIG is correct. Details: ${e.localizedMessage}"))
        }
    }
}
