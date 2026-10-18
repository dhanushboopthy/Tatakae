package dev.dhanush.tatakae.usagestats

import android.Manifest
import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Screen minutes (v2.5): reads foreground time from Android's UsageStatsManager once the user has
// granted "Usage access". Only raw facts cross to JS; the 04:00 IST day window and the summing live
// in TypeScript (src/native/usageMinutes.ts), where they are tested. Nothing here writes anything.
class UsageStatsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("TatakaeUsageStats")

    Function("hasPermission") { hasPermission() }

    Function("openPermissionSettings") {
      context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    // Foreground ("fg") and background ("bg") events for the given apps in [startMs, endMs), oldest first.
    AsyncFunction("events") { startMs: Double, endMs: Double, packages: List<String> ->
      if (!hasPermission() || packages.isEmpty()) return@AsyncFunction emptyList<Map<String, Any>>()
      val wanted = packages.toHashSet()
      val usage = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val events = usage.queryEvents(startMs.toLong(), endMs.toLong())
      val event = UsageEvents.Event()
      val out = ArrayList<Map<String, Any>>()
      while (events.hasNextEvent()) {
        events.getNextEvent(event)
        if (event.packageName !in wanted) continue
        val kind = when (event.eventType) {
          UsageEvents.Event.ACTIVITY_RESUMED -> "fg"
          UsageEvents.Event.ACTIVITY_PAUSED -> "bg"
          else -> continue
        }
        out.add(mapOf("pkg" to event.packageName, "kind" to kind, "t" to event.timeStamp.toDouble()))
      }
      out
    }

    // Apps with a launcher icon used in [startMs, endMs), most used first, for choosing which ones count.
    // Minutes are Android's own daily totals: close enough for ranking, not used for the day's number.
    AsyncFunction("recentApps") { startMs: Double, endMs: Double ->
      if (!hasPermission()) return@AsyncFunction emptyList<Map<String, Any>>()
      val usage = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val pm = context.packageManager
      usage.queryAndAggregateUsageStats(startMs.toLong(), endMs.toLong()).values
        .filter { it.totalTimeInForeground > 0 && it.packageName != context.packageName }
        .sortedByDescending { it.totalTimeInForeground }
        .mapNotNull { stats ->
          if (pm.getLaunchIntentForPackage(stats.packageName) == null) return@mapNotNull null
          val label = try {
            pm.getApplicationLabel(pm.getApplicationInfo(stats.packageName, 0)).toString()
          } catch (_: PackageManager.NameNotFoundException) {
            return@mapNotNull null
          }
          mapOf("packageName" to stats.packageName, "label" to label, "minutes" to stats.totalTimeInForeground / 60_000.0)
        }
        .take(MAX_APPS)
    }
  }

  private fun hasPermission(): Boolean {
    val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    } else {
      @Suppress("DEPRECATION")
      ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    }
    if (mode == AppOpsManager.MODE_DEFAULT) {
      return context.checkCallingOrSelfPermission(Manifest.permission.PACKAGE_USAGE_STATS) == PackageManager.PERMISSION_GRANTED
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }

  private companion object {
    const val MAX_APPS = 40
  }
}
