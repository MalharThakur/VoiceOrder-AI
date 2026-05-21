package com.example

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.example.data.Customer
import com.example.data.Product
import com.example.data.GeminiService
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ExampleRobolectricTest {

  @Test
  fun `read string from context`() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val appName = context.getString(R.string.app_name)
    assertEquals("VoiceOrder AI", appName)
  }

  @Test
  fun testGeminiTextOrder() = runBlocking {
    val service = GeminiService()
    println("=== START TEST ===")
    println("Checking API Key: ${BuildConfig.GEMINI_API_KEY}")
    println("Env GEMINI_API_KEY: ${System.getenv("GEMINI_API_KEY")}")
    try {
        val result = service.processTextOrder(
            "I want to place an order of 3 Sourdough Breads for Alice Smith",
            listOf(Customer(id = 1, name = "Alice Smith")),
            listOf(Product(id = 4, name = "Sourdough Bread", price = 3.99))
        )
        println("Gemini result: $result")
    } catch(e: Exception) {
        println("Exception during processTextOrder: ${e.message}")
        e.printStackTrace()
    }
    println("=== END TEST ===")
  }
}
