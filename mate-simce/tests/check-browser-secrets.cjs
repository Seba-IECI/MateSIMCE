const assert = require("node:assert/strict");
const { readFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");
const { loadEnvConfig } = require("@next/env");

const project = join(__dirname, "..");
loadEnvConfig(project, false);

const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
let keyIsPublic = publicKey.startsWith("sb_publishable_");
if (publicKey.split(".").length === 3) {
  const payload = JSON.parse(Buffer.from(publicKey.split(".")[1], "base64url").toString("utf8"));
  keyIsPublic = payload.role === "anon";
}
assert.ok(keyIsPublic, "La clave destinada al navegador debe ser anon o publishable.");

const privateValues = ["GEMINI_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]
  .map((name) => process.env[name])
  .filter((value) => value && value.length >= 12);

let inspected = 0;
function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) inspect(path);
    else if (/\.(?:js|map|html|json)$/.test(entry.name)) {
      const content = readFileSync(path, "utf8");
      assert.ok(!privateValues.some((value) => content.includes(value)), "Un archivo público contiene una credencial privada.");
      inspected += 1;
    }
  }
}
inspect(join(project, ".next", "static"));
assert.ok(inspected > 0, "Primero debe generarse el build.");
console.log(`Verificados ${inspected} archivos públicos: sin las credenciales privadas configuradas.`);
