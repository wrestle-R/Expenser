import postgres from "postgres";
import { loadFinancialCipher } from "../lib/financial-encryption.mjs";
import { cutOverEncryptedStorage, prepareEncryptedStorage } from "../lib/financial-encryption-cutover.mjs";

const [mode, file] = process.argv.slice(2);
if (!["--preflight", "--apply"].includes(mode) || !file) {
  console.error("Usage: node scripts/financial-encryption-cutover.mjs --preflight|--apply /path/to/private-env");
  process.exit(1);
}
process.loadEnvFile(file);
const connection = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
if (!connection) throw new Error("Database connection is required");
const db = postgres(connection, { ssl: "require", max: 1, prepare: false, onnotice: () => {} });
try {
  const [prerequisites] = await db`
    select
      to_regclass('cron.job') is not null as cron,
      to_regclass('vault.secrets') is not null as vault,
      exists (select 1 from pg_extension where extname = 'pg_net') as networking,
      exists (select 1 from pg_available_extensions where name = 'pg_net') as networking_available
  `;
  if (mode === "--preflight") {
    console.log(JSON.stringify(prerequisites));
  } else {
    if (!prerequisites.cron || !prerequisites.vault || (!prerequisites.networking && !prerequisites.networking_available)) throw new Error("Scheduled workflow extensions are unavailable");
    if (!process.env.FINANCIAL_SCHEDULER_URL || !process.env.FINANCIAL_SCHEDULER_TOKEN) {
      throw new Error("Scheduled workflow URL and token are required");
    }
    const key = loadFinancialCipher();
    await prepareEncryptedStorage(db);
    const counts = await cutOverEncryptedStorage(db, key, {
      scheduler: { url: process.env.FINANCIAL_SCHEDULER_URL, token: process.env.FINANCIAL_SCHEDULER_TOKEN },
    });
    console.log(JSON.stringify({ cutover: "complete", counts }));
  }
} catch (error) {
  console.error("Encrypted storage operation failed", error.code ?? error.name);
  process.exitCode = 1;
} finally {
  await db.end();
}
