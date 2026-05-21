package com.example.data

import androidx.room.withTransaction
import kotlinx.coroutines.flow.Flow

class VoiceOrderRepository(private val db: AppDatabase) {
    private val productDao = db.productDao()
    private val customerDao = db.customerDao()
    private val orderDao = db.orderDao()
    private val orderItemDao = db.orderItemDao()

    val allProducts: Flow<List<Product>> = productDao.getAllProductsFlow()
    val allCustomers: Flow<List<Customer>> = customerDao.getAllCustomersFlow()
    val allOrders: Flow<List<OrderWithCustomer>> = orderDao.getAllOrdersWithCustomerFlow()

    suspend fun getAllProductsList(): List<Product> = productDao.getAllProductsList()
    suspend fun getAllCustomersList(): List<Customer> = customerDao.getAllCustomersList()

    suspend fun insertProduct(product: Product) = productDao.insertProduct(product)
    suspend fun insertCustomer(customer: Customer) = customerDao.insertCustomer(customer)

    suspend fun insertProductBulk(products: List<Product>) {
        productDao.insertBulk(products)
    }

    suspend fun insertCustomerBulk(customers: List<Customer>) {
        customerDao.insertBulk(customers)
    }

    suspend fun createOrder(order: Order, items: List<OrderItem>) {
        db.withTransaction {
            val orderId = orderDao.insertOrder(order).toInt()
            val itemsWithOrderId = items.map { it.copy(order_id = orderId) }
            orderItemDao.insertOrderItems(itemsWithOrderId)
        }
    }

    suspend fun clearAllData() {
        db.withTransaction {
            orderItemDao.deleteAllOrderItems()
            orderDao.deleteAllOrders()
            productDao.deleteAllProducts()
            customerDao.deleteAllCustomers()
        }
    }
}
