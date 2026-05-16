const { spawnSync } = require("node:child_process");
const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const root = resolve(__dirname, "..");
const envPath = resolve(root, ".env");

function parseDotEnv(contents) {
  const parsed = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[match[1]] = value;
  }
  return parsed;
}

const fileEnv = existsSync(envPath) ? parseDotEnv(readFileSync(envPath, "utf8")) : {};
const env = { ...process.env, ...fileEnv };

// TODO(auth): Temporary developer-only compatibility shim. Remove after
// authenticated per-user/provider credential storage is implemented.
if (!env.GEMINI_API_KEY && !env.GOOGLE_API_KEY) {
  if (env.DEV_ADMIN_GEMINI_API_KEY) {
    env.GEMINI_API_KEY = env.DEV_ADMIN_GEMINI_API_KEY;
  } else if (env.NODE_ENV !== "production" && env.VITE_AI_API_KEY) {
    env.GEMINI_API_KEY = env.VITE_AI_API_KEY;
  }
}

const args = process.argv.slice(2);
const finalArgs = args.length ? args : ["extract", "."];
const result = spawnSync("graphify", finalArgs, {
  cwd: root,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
