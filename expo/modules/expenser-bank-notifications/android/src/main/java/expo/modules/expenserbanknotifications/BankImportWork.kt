package expo.modules.expenserbanknotifications

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import expo.modules.backgroundtask.BackgroundTaskConsumer
import expo.modules.interfaces.taskManager.TaskServiceProviderHelper
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.withTimeoutOrNull

class BankImportWork(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
  override suspend fun doWork(): Result {
    if (!BankImportControls.enabled(applicationContext)) return Result.success()
    val scope = applicationContext.packageName
    val service = TaskServiceProviderHelper.getTaskServiceImpl(applicationContext) ?: return Result.success()
    if (!service.hasRegisteredTask(TASK, scope)) return Result.success()
    // Expenser registers one Expo background task. Keep periodic work independent
    // so a notification wakeup cannot replace the recovery schedule.
    val consumer = service.getTaskConsumers(scope).filterIsInstance<BackgroundTaskConsumer>().singleOrNull()
      ?: return Result.success()
    val completion = CompletableDeferred<Boolean>()
    consumer.executeTask { response -> completion.complete((response["result"] as? Number)?.toInt() == 1) }
    val success = withTimeoutOrNull(180_000) { completion.await() }
    return if (success == true) Result.success() else Result.retry()
  }

  companion object {
    const val TASK = "expenser-bank-import"

    fun enqueue(context: Context) {
      val work = OneTimeWorkRequestBuilder<BankImportWork>()
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .build()
      WorkManager.getInstance(context).enqueueUniqueWork(TASK, ExistingWorkPolicy.APPEND_OR_REPLACE, work)
    }
  }
}
