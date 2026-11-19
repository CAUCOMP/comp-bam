import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(
  new URL("../node_modules/.bin/supabase", import.meta.url),
);
const exclude =
  "realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor";
execFileSync(cli, ["start", "-x", exclude], {
  stdio: ["inherit", "ignore", "inherit"],
});
execFileSync(cli, ["migration", "up", "--local"], { stdio: "inherit" });
const state = JSON.parse(
  execFileSync(cli, ["status", "-o", "json"], { encoding: "utf8" }),
);
const publishable = state.PUBLISHABLE_KEY || state.ANON_KEY;
if (!publishable)
  throw new Error("Supabase 로컬 publishable key를 읽을 수 없습니다.");
writeFileSync(
  ".env.compbam.local",
  "VITE_SUPABASE_URL=/_supabase\nVITE_SUPABASE_PUBLISHABLE_KEY=" +
    publishable +
    "\n",
  { mode: 0o600 },
);

mkdirSync(".comp-bam", { recursive: true, mode: 0o700 });
const file = ".comp-bam/operator-key";
try {
  writeFileSync(file, randomBytes(32).toString("hex"), {
    flag: "wx",
    mode: 0o600,
  });
} catch (error) {
  if (error.code !== "EEXIST") throw error;
}
const secret = readFileSync(file, "utf8").trim();
const digest = createHash("sha256").update(secret).digest("hex");
execFileSync(
  "docker",
  [
    "exec",
    "-i",
    "supabase_db_comp-bam",
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
  ],
  {
    input: "UPDATE bam.event SET host_hash = '" + digest + "' WHERE singleton;",
    stdio: ["pipe", "ignore", "inherit"],
  },
);
console.log("프론트 실행: npm run dev:local");
console.log("참가자: http://localhost:5173/");
console.log("운영진 비공개 링크: http://localhost:5173/admin#key=" + secret);
