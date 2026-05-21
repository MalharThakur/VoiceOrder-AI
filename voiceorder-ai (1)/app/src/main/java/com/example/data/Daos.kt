package com.example.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

data class OrderWithCustomer(
    val id: Int,
    val customer_id: Int?,
    val total_amount: Double,
    val status: String,
    val created_at: Long,
    val ai_cost: Double,
    val customer_name: String?,
    val customer_code: String?
)

@Dao
interface ProductDao {
    @Query("SELECT * FROM products ORDER BY name ASC")
    fun getAllProductsFlow(): Flow<List<Product>>

    @Query("SELECT * FROM products")
    suspend fun getAllProductsList(): List<Product>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProduct(product: Product): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertBulk(products: List<Product>)

    @Query("DELETE FROM products")
    suspend fun deleteAllProducts()
}

@Dao
interface CustomerDao {
    @Query("SELECT * FROM customers ORDER BY name ASC")
    fun getAllCustomersFlow(): Flow<List<Customer>>

    @Query("SELECT * FROM customers")
    suspend fun getAllCustomersList(): List<Customer>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCustomer(customer: Customer): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertBulk(customers: List<Customer>)

    @Query("DELETE FROM customers")
    suspend fun deleteAllCustomers()
}

@Dao
interface OrderDao {
    @Query("""
        SELECT o.id, o.customer_id, o.total_amount, o.status, o.created_at, o.ai_cost, 
               c.name as customer_name, c.code as customer_code 
        FROM orders o 
        LEFT JOIN customers c ON o.customer_id = c.id 
        ORDER BY o.created_at DESC
    """)
    fun getAllOrdersWithCustomerFlow(): Flow<List<OrderWithCustomer>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrder(order: Order): Long

    @Query("DELETE FROM orders")
    suspend fun deleteAllOrders()
}

@Dao
interface OrderItemDao {
    @Query("SELECT * FROM order_items WHERE order_id = :orderId")
    suspend fun getItemsForOrder(orderId: Int): List<OrderItem>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrderItems(items: List<OrderItem>)

    @Query("DELETE FROM order_items")
    suspend fun deleteAllOrderItems()
}
