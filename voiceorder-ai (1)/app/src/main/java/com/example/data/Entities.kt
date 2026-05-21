package com.example.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.ForeignKey
import androidx.room.Index

@Entity(tableName = "customers")
data class Customer(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val email: String? = null,
    val phone: String? = null,
    val code: String? = null
)

@Entity(tableName = "products")
data class Product(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val price: Double,
    val sku: String? = null
)

@Entity(
    tableName = "orders",
    foreignKeys = [
        ForeignKey(
            entity = Customer::class,
            parentColumns = ["id"],
            childColumns = ["customer_id"],
            onDelete = ForeignKey.SET_NULL
        )
    ],
    indices = [Index(value = ["customer_id"])]
)
data class Order(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val customer_id: Int?,
    val total_amount: Double,
    val status: String = "pending",
    val created_at: Long = System.currentTimeMillis(),
    val ai_cost: Double = 0.0
)

@Entity(
    tableName = "order_items",
    foreignKeys = [
        ForeignKey(
            entity = Order::class,
            parentColumns = ["id"],
            childColumns = ["order_id"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = Product::class,
            parentColumns = ["id"],
            childColumns = ["product_id"],
            onDelete = ForeignKey.SET_NULL
        )
    ],
    indices = [
        Index(value = ["order_id"]),
        Index(value = ["product_id"])
    ]
)
data class OrderItem(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val order_id: Int,
    val product_id: Int?,
    val quantity: Int,
    val price: Double
)
