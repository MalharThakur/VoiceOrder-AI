package com.example.util

import android.util.Log

object CsvParser {

    /**
     * Parse a CSV string into a List of Maps containing header-to-value pairings.
     * Accurately parses standard CSV of any size, handling quotes and commas.
     */
    fun parseCsv(csvText: String): List<Map<String, String>> {
        val records = mutableListOf<Map<String, String>>()
        val lines = csvText.split(Regex("\\r?\\n"))
        if (lines.isEmpty()) return records

        val headers = parseCsvLine(lines[0])
        if (headers.isEmpty()) return records

        for (i in 1 until lines.size) {
            val line = lines[i].trim()
            if (line.isEmpty()) continue
            val values = parseCsvLine(line)
            
            val record = mutableMapOf<String, String>()
            for (j in 0 until headers.size) {
                val header = headers[j].trim()
                val value = values.getOrNull(j)?.trim() ?: ""
                record[header] = value
            }
            records.add(record)
        }
        return records
    }

    private fun parseCsvLine(line: String): List<String> {
        val result = mutableListOf<String>()
        var curVal = StringBuilder()
        var inQuotes = false
        var i = 0
        while (i < line.length) {
            val ch = line[i]
            if (inQuotes) {
                if (ch == '\"') {
                    if (i + 1 < line.length && line[i + 1] == '\"') {
                        curVal.append('\"') // Escaped quote
                        i++
                    } else {
                        inQuotes = false // End of quotes
                    }
                } else {
                    curVal.append(ch)
                }
            } else {
                if (ch == '\"') {
                    inQuotes = true
                } else if (ch == ',') {
                    result.add(curVal.toString())
                    curVal = StringBuilder()
                } else {
                    curVal.append(ch)
                }
            }
            i++
        }
        result.add(curVal.toString())
        return result
    }

    // Helper to extract a value from a record with a list of possible keys case-insensitively
    fun getRecordValue(record: Map<String, String>, possibleKeys: List<String>): String? {
        for (possibleKey in possibleKeys) {
            val cleanKey = possibleKey.lowercase().trim()
            for ((header, value) in record) {
                if (header.lowercase().trim() == cleanKey) {
                    return value
                }
            }
        }
        return null
    }
}
