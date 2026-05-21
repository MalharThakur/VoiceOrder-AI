package com.example.data

import android.util.Base64
import android.util.Log
import com.example.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

class GeminiService {

    private val client = OkHttpClient.Builder()
        .connectTimeout(60, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    private suspend fun executeWithRetry(request: Request, maxAttempts: Int = 3): okhttp3.Response = withContext(Dispatchers.IO) {
        var lastException: Exception? = null
        var delayMs = 1500L

        for (attempt in 1..maxAttempts) {
            try {
                val response = client.newCall(request).execute()
                if (response.code == 429) {
                    val bodyStr = try { response.peekBody(2048).string() } catch (ignored: Exception) { "" }
                    Log.w("GeminiService", "Attempt $attempt got HTTP 429 (Rate Limit). Retrying in ${delayMs / 1000.0}s...")
                    response.close()
                    if (attempt < maxAttempts) {
                        delay(delayMs)
                        delayMs *= 2 // Exponential backoff
                        continue
                    }
                    throw Exception("The Gemini AI service is currently reaching its request limits. Please wait a few seconds and try speaking or typing again!")
                }
                return@withContext response
            } catch (e: Exception) {
                lastException = e
                Log.e("GeminiService", "Attempt $attempt failed with error: ${e.message}", e)
                if (attempt < maxAttempts) {
                    delay(delayMs)
                    delayMs *= 2
                    continue
                }
            }
        }
        throw lastException ?: Exception("Network request failed after $maxAttempts attempts due to rate limit or connection issues.")
    }

    // Structured output result of the voice processing
    data class GeminiOrderResult(
        val customerId: Int?,
        val detectedCustomerName: String?,
        val items: List<GeminiOrderItem>,
        val aiCost: Double
    )

    data class GeminiOrderItem(
        val detectedProductName: String,
        val quantity: Int,
        val productId: Int?,
        val suggestedProductIds: List<Int>
    )

    suspend fun processTextOrder(
        textPrompt: String,
        customers: List<Customer>,
        products: List<Product>
    ): GeminiOrderResult? = withContext(Dispatchers.IO) {
        val apiKey = BuildConfig.GEMINI_API_KEY
        if (apiKey.isEmpty() || apiKey == "MY_GEMINI_API_KEY") {
            Log.e("GeminiService", "API Key is missing or default placeholder!")
            throw Exception("Gemini API Key is missing or default placeholder! Please check if GEMINI_API_KEY is properly set in the Secrets panel in AI Studio before generating your APK.")
        }

        try {
            val customerList = customers.take(1000).joinToString("\n") { "ID:${it.id}, Name:${it.name}" }
            val productList = products.take(1000).joinToString("\n") { "ID:${it.id}, Name:${it.name}" }

            val prompt = """
                Extract order details from the user text: "$textPrompt"
                
                CUSTOMERS:
                $customerList
                
                PRODUCTS:
                $productList

                Your response must map the customer name and items verbatim or semantically to the provided lists above.
                Set "customerId" to the exact matched integer ID from the CUSTOMERS list, and set "detectedCustomerName" to the user's spoken/typed name.
                For each item, identify "detectedProductName" (such as "Sourdough Breads" or "Coffee Beans"), "quantity", "productId" (the matched integer ID from the PRODUCTS list above, or null if no match matches), and "suggestedProductIds" (a list of other potential matching product integer IDs if ambiguous).
            """.trimIndent()

            val systemInstr = """
                You are a highly-accurate logistics transcribing AI assistant. Your goal is to parse user order requests and map them to the database lists provided.

                RULES:
                1. Match Customer: Find the customer in the provided list. Return their exact database ID in "customerId". Also return the spoken/typed name in "detectedCustomerName".
                2. Match Products: Map product names to the closest semantic database products list. Ensure "productId" is the exact matched ID from the PRODUCTS list.
                3. Be strict with quantities: Match the exact number of units mentioned.
                4. No Hallucinations: If a customer or product does not match anything in the provided lists, still return the "detectedCustomerName" and "detectedProductName" values as text, with "customerId" or "productId" as null, so that the client-side fuzzy matcher can handle them.
            """.trimIndent()

            val rootJson = JSONObject().apply {
                val contentsArray = JSONArray().apply {
                    val contentObj = JSONObject().apply {
                        val partsArray = JSONArray().apply {
                            val textPart = JSONObject().apply {
                                put("text", prompt)
                            }
                            put(textPart)
                        }
                        put("parts", partsArray)
                    }
                    put(contentObj)
                }
                put("contents", contentsArray)

                val systemInstructionObj = JSONObject().apply {
                    val partsArray = JSONArray().apply {
                        val partText = JSONObject().apply {
                            put("text", systemInstr)
                        }
                        put(partText)
                    }
                    put("parts", partsArray)
                }
                put("systemInstruction", systemInstructionObj)

                val generationConfig = JSONObject().apply {
                    put("responseMimeType", "application/json")
                    put("temperature", 0.1) // Low temperature for deterministic matching
                    
                    val responseSchema = JSONObject().apply {
                        put("type", "OBJECT")
                        val properties = JSONObject().apply {
                            put("customerId", JSONObject().apply { put("type", "INTEGER") })
                            put("detectedCustomerName", JSONObject().apply { put("type", "STRING") })
                            put("items", JSONObject().apply {
                                put("type", "ARRAY")
                                put("items", JSONObject().apply {
                                    put("type", "OBJECT")
                                    val itemProperties = JSONObject().apply {
                                        put("detectedProductName", JSONObject().apply { put("type", "STRING") })
                                        put("quantity", JSONObject().apply { put("type", "INTEGER") })
                                        put("productId", JSONObject().apply { put("type", "INTEGER") })
                                        put("suggestedProductIds", JSONObject().apply {
                                            put("type", "ARRAY")
                                            put("items", JSONObject().apply { put("type", "INTEGER") })
                                        })
                                    }
                                    put("properties", itemProperties)
                                    val itemRequired = JSONArray().apply {
                                        put("detectedProductName")
                                        put("quantity")
                                    }
                                    put("required", itemRequired)
                                })
                            })
                        }
                        put("properties", properties)
                    }
                    put("responseSchema", responseSchema)
                }
                put("generationConfig", generationConfig)
            }

            val requestBody = rootJson.toString().toRequestBody("application/json".toMediaType())
            val url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$apiKey"

            val request = Request.Builder()
                .url(url)
                .post(requestBody)
                .build()

            executeWithRetry(request).use { response ->
                if (!response.isSuccessful) {
                    val errBody = response.body?.string() ?: ""
                    println("API request failed with code ${response.code}: $errBody")
                    Log.e("GeminiService", "API request failed with code ${response.code}: $errBody")
                    throw Exception("Gemini API Request failed (HTTP ${response.code}): $errBody")
                }

                val responseBody = response.body?.string() ?: ""
                println("Response received: $responseBody")
                Log.d("GeminiService", "Response received: $responseBody")

                val responseJson = JSONObject(responseBody)
                val candidates = responseJson.optJSONArray("candidates") 
                    ?: throw Exception("Invalid API response: No 'candidates' array found. Raw response: $responseBody")
                if (candidates.length() == 0) {
                    throw Exception("Gemini API failed to return any candidate content suggestions. Raw response: $responseBody")
                }
                
                val contentObj = candidates.getJSONObject(0).optJSONObject("content") 
                    ?: throw Exception("Invalid API response: No 'content' block in first candidate. Raw response: $responseBody")
                val parts = contentObj.optJSONArray("parts") 
                    ?: throw Exception("Invalid API response: No 'parts' array in content. Raw response: $responseBody")
                if (parts.length() == 0) {
                    throw Exception("Invalid API response: Empty 'parts' array. Raw response: $responseBody")
                }

                val text = parts.getJSONObject(0).optString("text", "{}")

                // Compute cost
                val usageMetadata = responseJson.optJSONObject("usageMetadata")
                val promptTokenCount = usageMetadata?.optInt("promptTokenCount") ?: 0
                val candidatesTokenCount = usageMetadata?.optInt("candidatesTokenCount") ?: 0
                val promptCost = promptTokenCount * 0.000000075
                val candidateCost = candidatesTokenCount * 0.0000003
                val totalCost = promptCost + candidateCost

                val orderJson = JSONObject(text)
                val customerIdVal = if (orderJson.isNull("customerId")) null else orderJson.optInt("customerId")
                val detectedCustName = if (orderJson.isNull("detectedCustomerName")) null else orderJson.optString("detectedCustomerName")
                
                val itemsArray = orderJson.optJSONArray("items") ?: JSONArray()
                val itemsList = mutableListOf<GeminiOrderItem>()
                for (i in 0 until itemsArray.length()) {
                    val itemObj = itemsArray.getJSONObject(i)
                    val name = itemObj.optString("detectedProductName", "")
                    val qty = itemObj.optInt("quantity", 1)
                    val pidVal = if (itemObj.isNull("productId")) null else itemObj.optInt("productId")
                    
                    val suggestionsArray = itemObj.optJSONArray("suggestedProductIds") ?: JSONArray()
                    val suggestionsList = mutableListOf<Int>()
                    for (j in 0 until suggestionsArray.length()) {
                        suggestionsList.add(suggestionsArray.getInt(j))
                    }

                    itemsList.add(GeminiOrderItem(name, qty, pidVal, suggestionsList))
                }

                return@withContext GeminiOrderResult(customerIdVal, detectedCustName, itemsList, totalCost)
            }
        } catch (e: Exception) {
            println("Error during text order processing: " + e.message)
            e.printStackTrace()
            Log.e("GeminiService", "Error during text order processing", e)
            throw e
        }
    }

    suspend fun transcribeAudio(
        audioFile: File
    ): String? = withContext(Dispatchers.IO) {
        val apiKey = BuildConfig.GEMINI_API_KEY
        if (apiKey.isEmpty() || apiKey == "MY_GEMINI_API_KEY") {
            Log.e("GeminiService", "API Key is missing or default placeholder!")
            throw Exception("Gemini API Key is missing or default placeholder! Please check if GEMINI_API_KEY is properly set in the Secrets panel in AI Studio before generating your APK.")
        }

        try {
            val audioBytes = audioFile.readBytes()
            val base64Audio = Base64.encodeToString(audioBytes, Base64.NO_WRAP)

            val prompt = """
                You are an expert audio transcriber. Listen to the audio and transcribe exactly what is spoken word-for-word.
                Do not summarize, do not translate to another style, and do not add any extra explanations or pleasantries.
                CRITICAL: Only output the text spoken in the audio. If the audio is completely silent or contains absolutely no human speech, respond with exactly "[Silence]". Otherwise, transcribe whatever speech is audible, even if there is background noise, static, or if it is quiet. Try your absolute best to transcribe every legible word.
            """.trimIndent()

            val rootJson = JSONObject().apply {
                val contentsArray = JSONArray().apply {
                    val contentObj = JSONObject().apply {
                        val partsArray = JSONArray().apply {
                            val audioPart = JSONObject().apply {
                                put("inlineData", JSONObject().apply {
                                    put("mimeType", "audio/mp4")
                                    put("data", base64Audio)
                                })
                            }
                            val textPart = JSONObject().apply {
                                put("text", prompt)
                            }
                            put(audioPart)
                            put(textPart)
                        }
                        put("parts", partsArray)
                    }
                    put(contentObj)
                }
                put("contents", contentsArray)

                val generationConfig = JSONObject().apply {
                    put("temperature", 0.0)
                }
                put("generationConfig", generationConfig)
            }

            val requestBody = rootJson.toString().toRequestBody("application/json".toMediaType())
            val url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$apiKey"

            val request = Request.Builder()
                .url(url)
                .post(requestBody)
                .build()

            executeWithRetry(request).use { response ->
                if (!response.isSuccessful) {
                    val errBody = response.body?.string() ?: ""
                    Log.e("GeminiService", "Transcription request failed with code ${response.code}: $errBody")
                    throw Exception("Gemini Transcription Request failed (HTTP ${response.code}): $errBody")
                }

                val responseBody = response.body?.string() ?: ""
                val responseJson = JSONObject(responseBody)
                val candidates = responseJson.optJSONArray("candidates") 
                    ?: throw Exception("Invalid API response: No 'candidates' array found during transcription.")
                if (candidates.length() == 0) {
                    throw Exception("Gemini API failed to return any transcription candidates.")
                }
                
                val contentObj = candidates.getJSONObject(0).optJSONObject("content") 
                    ?: throw Exception("Invalid API response: No 'content' block in first candidate.")
                val parts = contentObj.optJSONArray("parts") 
                    ?: throw Exception("Invalid API response: No 'parts' array found under first candidate.")
                if (parts.length() == 0) {
                    throw Exception("Invalid API response: First candidate contains empty 'parts' array.")
                }

                val transText = parts.getJSONObject(0).optString("text", "").trim()
                Log.d("GeminiService", "Transcription text received: $transText")
                return@withContext transText
            }
        } catch (e: Exception) {
            Log.e("GeminiService", "Error during transcribeAudio", e)
            throw e
        }
    }

    suspend fun processVoiceOrder(
        audioFile: File,
        customers: List<Customer>,
        products: List<Product>
    ): GeminiOrderResult? = withContext(Dispatchers.IO) {
        val apiKey = BuildConfig.GEMINI_API_KEY
        if (apiKey.isEmpty() || apiKey == "MY_GEMINI_API_KEY") {
            Log.e("GeminiService", "API Key is missing or default placeholder!")
            throw Exception("Gemini API Key is missing or default placeholder! Please check if GEMINI_API_KEY is properly set in the Secrets panel in AI Studio before generating your APK.")
        }

        try {
            // 1. Prepare base64 audio
            val audioBytes = audioFile.readBytes()
            val base64Audio = Base64.encodeToString(audioBytes, Base64.NO_WRAP)

            // 2. Prepare customers and products lists
            val customerList = customers.take(1000).joinToString("\n") { "ID:${it.id}, Name:${it.name}" }
            val productList = products.take(1000).joinToString("\n") { "ID:${it.id}, Name:${it.name}" }

            val prompt = """
                Extract logistics order details from this audio file. Map customer and product names to the database options lists provided below.
                
                CUSTOMERS:
                $customerList
                
                PRODUCTS:
                $productList

                Look for an order request. Find the matching customer and items. Return exact matching ID values or null if not directly matching.
            """.trimIndent()

            val systemInstr = """
                You are a highly-accurate logistics transcribing AI assistant. Your goal is to parse user voice orders and map them to the database lists provided.

                RULES:
                1. Match Customer: Find the customer in the provided list. Return their exact database ID in "customerId". Also return the spoken/typed name in "detectedCustomerName".
                2. Match Products: Map product names to the closest semantic database products list. Ensure "productId" is the exact matched ID from the PRODUCTS list.
                3. Be strict with quantities: Match the exact number of units mentioned.
                4. No Hallucinations: If a customer or product does not match anything in the provided lists, still return the "detectedCustomerName" and "detectedProductName" values as text, with "customerId" or "productId" as null, so that the client-side fuzzy matcher can handle them. Try your absolute best to extract any words spoken in the audio even if they do not exactly match products.
            """.trimIndent()

            // 3. Build JSON payload using native org.json
            val rootJson = JSONObject().apply {
                val contentsArray = JSONArray().apply {
                    val contentObj = JSONObject().apply {
                        val partsArray = JSONArray().apply {
                            // Part 1: Audio data
                            val audioPart = JSONObject().apply {
                                put("inlineData", JSONObject().apply {
                                    put("mimeType", "audio/mp4")
                                    put("data", base64Audio)
                                })
                            }
                            // Part 2: Text prompt
                            val textPart = JSONObject().apply {
                                put("text", prompt)
                            }
                            put(audioPart)
                            put(textPart)
                        }
                        put("parts", partsArray)
                    }
                    put(contentObj)
                }
                put("contents", contentsArray)

                val systemInstructionObj = JSONObject().apply {
                    val partsArray = JSONArray().apply {
                        val partText = JSONObject().apply {
                            put("text", systemInstr)
                        }
                        put(partText)
                    }
                    put("parts", partsArray)
                }
                put("systemInstruction", systemInstructionObj)

                // Generation Config with schema
                val generationConfig = JSONObject().apply {
                    put("responseMimeType", "application/json")
                    put("temperature", 0.1) // Low temperature for deterministic matching
                    
                    val responseSchema = JSONObject().apply {
                        put("type", "OBJECT")
                        val properties = JSONObject().apply {
                            put("customerId", JSONObject().apply { put("type", "INTEGER") })
                            put("detectedCustomerName", JSONObject().apply { put("type", "STRING") })
                            put("items", JSONObject().apply {
                                put("type", "ARRAY")
                                put("items", JSONObject().apply {
                                    put("type", "OBJECT")
                                    val itemProperties = JSONObject().apply {
                                        put("detectedProductName", JSONObject().apply { put("type", "STRING") })
                                        put("quantity", JSONObject().apply { put("type", "INTEGER") })
                                        put("productId", JSONObject().apply { put("type", "INTEGER") })
                                        put("suggestedProductIds", JSONObject().apply {
                                            put("type", "ARRAY")
                                            put("items", JSONObject().apply { put("type", "INTEGER") })
                                        })
                                    }
                                    put("properties", itemProperties)
                                    val itemRequired = JSONArray().apply {
                                        put("detectedProductName")
                                        put("quantity")
                                    }
                                    put("required", itemRequired)
                                })
                            })
                        }
                        put("properties", properties)
                    }
                    put("responseSchema", responseSchema)
                }
                put("generationConfig", generationConfig)
            }

            // 4. Fire network request
            val requestBody = rootJson.toString().toRequestBody("application/json".toMediaType())
            val url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$apiKey"

            val request = Request.Builder()
                .url(url)
                .post(requestBody)
                .build()

            executeWithRetry(request).use { response ->
                if (!response.isSuccessful) {
                    val errBody = response.body?.string() ?: ""
                    Log.e("GeminiService", "API request failed with code ${response.code}: $errBody")
                    return@withContext null
                }

                val responseBody = response.body?.string() ?: ""
                Log.d("GeminiService", "Response received: $responseBody")

                // 5. Parse response
                val responseJson = JSONObject(responseBody)
                val candidates = responseJson.optJSONArray("candidates") ?: return@withContext null
                if (candidates.length() == 0) return@withContext null
                
                val contentObj = candidates.getJSONObject(0).optJSONObject("content") ?: return@withContext null
                val parts = contentObj.optJSONArray("parts") ?: return@withContext null
                if (parts.length() == 0) return@withContext null

                val text = parts.getJSONObject(0).optString("text", "{}")

                // Compute cost
                val usageMetadata = responseJson.optJSONObject("usageMetadata")
                val promptTokenCount = usageMetadata?.optInt("promptTokenCount") ?: 0
                val candidatesTokenCount = usageMetadata?.optInt("candidatesTokenCount") ?: 0
                val promptCost = promptTokenCount * 0.000000075
                val candidateCost = candidatesTokenCount * 0.0000003
                val totalCost = promptCost + candidateCost

                // 6. Parse structured text JSON
                val orderJson = JSONObject(text)
                val customerIdVal = if (orderJson.isNull("customerId")) null else orderJson.optInt("customerId")
                val detectedCustName = if (orderJson.isNull("detectedCustomerName")) null else orderJson.optString("detectedCustomerName")
                
                val itemsArray = orderJson.optJSONArray("items") ?: JSONArray()
                val itemsList = mutableListOf<GeminiOrderItem>()
                for (i in 0 until itemsArray.length()) {
                    val itemObj = itemsArray.getJSONObject(i)
                    val name = itemObj.optString("detectedProductName", "")
                    val qty = itemObj.optInt("quantity", 1)
                    val pidVal = if (itemObj.isNull("productId")) null else itemObj.optInt("productId")
                    
                    val suggestionsArray = itemObj.optJSONArray("suggestedProductIds") ?: JSONArray()
                    val suggestionsList = mutableListOf<Int>()
                    for (j in 0 until suggestionsArray.length()) {
                        suggestionsList.add(suggestionsArray.getInt(j))
                    }

                    itemsList.add(GeminiOrderItem(name, qty, pidVal, suggestionsList))
                }

                return@withContext GeminiOrderResult(customerIdVal, detectedCustName, itemsList, totalCost)
            }
        } catch (e: Exception) {
            Log.e("GeminiService", "Error during voice order processing", e)
            throw e
        }
    }
}
