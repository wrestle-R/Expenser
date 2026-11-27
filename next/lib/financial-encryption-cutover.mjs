import { readFileSync } from "node:fs";
import { backfillFinancialEncryption, verifyFinancialEncryptionBackfill } from "./financial-encryption-backfill.mjs";

const prepareSql = new URL("../../supabase/008_prepare_financial_encryption.sql", import.meta.url);
const cutoverSql = new URL("../../supabase/009_financial_encryption_cutover.sql", import.meta.url);

export async function prepareEncryptedStorage(db) {
  const reserved = await db.reserve();
  try {
    await reserved.unsafe(readFileSync(prepareSql, "utf8"));
  } catch (error) {
    await reserved`rollback`;
    throw error;
  } finally {
    reserved.release();
  }
}

async function replaceCron(tx, scheduler) {
  const endpoint = new URL(scheduler.url);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password ||
      endpoint.pathname !== "/api/internal/scheduled-workflows" || endpoint.search || endpoint.hash ||
      !/^[A-Za-z0-9_-]{43,}$/.test(scheduler.token)) throw new Error("Invalid scheduled workflow configuration");
  await tx`create extension if not exists pg_net`;
  const keyName = "expenser_encrypted_scheduler_token";
  const [old] = await tx`select id from vault.secrets where name = ${keyName}`;
  if (old) await tx`select vault.update_secret(${old.id}, ${scheduler.token})`;
  else await tx`select vault.create_secret(${scheduler.token}, ${keyName})`;
  const command = `select net.http_post(
    url := '${endpoint.href}',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (
      select decrypted_secret from vault.decrypted_secrets where name = '${keyName}'
    )), timeout_milliseconds := 30000
  ) where exists (select 1 from public.workflows where next_run_at <= now()
      and (processing_retry_after is null or processing_retry_after <= now()))`;
  await tx`select cron.unschedule(jobid) from cron.job where command ~* '(^|[^a-z_])process_due_workflows[[:space:]]*\\('`;
  await tx`select cron.schedule('expenser-encrypted-workflows', '* * * * *', ${command})`;
}

export async function cutOverEncryptedStorage(db, cipher, { scheduler } = {}) {
  return db.begin(async (tx) => {
    await tx`set local lock_timeout = '10s'`;
    await tx`set local statement_timeout = '120s'`;
    await tx`
      lock table public.transactions, public.balances, public.balance_reconciliation_alerts,
        public.user_categories, public.workflows, public.users, public.workflow_occurrences,
        expenser_private.financial_payloads in access exclusive mode
    `;
    const [state] = await tx`
      select exists (
        select 1 from pg_constraint where conrelid = 'public.transactions'::regclass
        and conname = 'transactions_encrypted_fields'
      ) as encrypted
    `;
    if (state.encrypted) {
      throw new Error("Financial cutover already applied. Do not backfill scrubbed rows.");
    }
    // All pages use the outer transaction. The verification and scrub either
    // both commit or neither commits.
    const locked = { begin: (work) => work(tx) };
    const counts = await backfillFinancialEncryption(locked, cipher);
    await verifyFinancialEncryptionBackfill(locked, cipher);
    // A preliminary backfill may have seen rows that were subsequently deleted.
    for (const kind of Object.keys(counts)) {
      const id = kind === "balances" ? "payment_method" : "id";
      await tx`
        delete from expenser_private.financial_payloads payload where record_kind = ${kind}
          and not exists (select 1 from public.${tx(kind)} source where source.user_id = payload.owner_id
            and source.${tx(id)}::text = payload.record_id)
      `;
    }
    await tx`select set_config('expenser.verified_cutover', 'yes', true)`;
    await tx.unsafe(readFileSync(cutoverSql, "utf8"));
    if (scheduler) await replaceCron(tx, scheduler);
    return counts;
  });
}
