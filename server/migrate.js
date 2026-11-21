// Standalone Migration Script for DCAS Sports Meet
// Usage:
//   node server/migrate.js             -> Generates a private SQL export under server/data/exports/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateMigrationSql } from "./index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(here, "data", "db.json");

if (!fs.existsSync(dbPath)) {
  console.error("❌ db.json not found at:", dbPath);
  process.exit(1);
}

try {
  const dbData = JSON.parse(fs.readFileSync(dbPath, "utf8"));
  const sql = generateMigrationSql(dbData);
  const exportDir = path.join(here, "data", "exports");
  fs.mkdirSync(exportDir, { recursive: true });
  const outPath = path.join(exportDir, `migration_supabase_${Date.now()}.sql`);
  fs.writeFileSync(outPath, sql, "utf8");

  console.log("==================================================");
  console.log("🏆 DCAS Sports Meet – Database Migration Tool");
  console.log("==================================================");
  console.log(`✅ Loaded local database from: ${dbPath}`);
  console.log(`   - Tournament: ${dbData.config?.name}`);
  console.log(`   - Teams/Houses: ${dbData.config?.houses?.length || 0}`);
  console.log(`   - Events configured: ${dbData.events?.length || 0}`);
  console.log(`   - Student registrations: ${dbData.regs?.length || 0}`);
  console.log(`   - Published results: ${Object.keys(dbData.results || {}).length}`);
  console.log(`   - Judge scores: ${dbData.scores?.length || 0}`);
  console.log("--------------------------------------------------");
  console.log(`🚀 PostgreSQL / Supabase migration SQL generated successfully!`);
  console.log(`📁 File target: ${outPath}`);
  console.log("--------------------------------------------------");
  console.log("To import into Supabase or PostgreSQL:");
  console.log("1. Open your Supabase Dashboard -> SQL Editor");
  console.log(`2. Review and securely store '${outPath}'`);
  console.log("3. Run it in the SQL Editor for a new/empty Supabase project only.");
  console.log("The export contains participant/activity records but omits legacy captain passwords.");
  console.log("==================================================");
} catch (err) {
  console.error("❌ Migration failed:", err);
  process.exit(1);
}
