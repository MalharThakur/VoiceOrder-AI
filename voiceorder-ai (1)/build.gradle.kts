// Top-level build file where you can add configuration options common to all sub-projects/modules.

val systemKey: String = System.getenv("GEMINI_API_KEY") ?: ""
if (systemKey.isNotEmpty()) {
    val envFile = file(".env")
    envFile.writeText("GEMINI_API_KEY=$systemKey\n")
}

plugins {
  alias(libs.plugins.android.application) apply false
  alias(libs.plugins.kotlin.compose) apply false
  alias(libs.plugins.google.devtools.ksp) apply false
  alias(libs.plugins.roborazzi) apply false
  alias(libs.plugins.secrets) apply false
}
