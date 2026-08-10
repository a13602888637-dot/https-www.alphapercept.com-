#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { dirname, join, resolve } from "node:path";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const STATE_ROOT = resolve(process.env.ALPHAPERCEPT_WORKER_HOME || join(homedir(), ".local", "share", "alphapercept-worker"));
const SECRET_PATH = join(STATE_ROOT, "worker-secret");
const INSTALL_ROOT = join(STATE_ROOT, "app");
const INSTALLED_WORKER_PATH = join(INSTALL_ROOT, "scripts", "uzi-local-worker.mjs");
const LABEL = "com.alphapercept.uzi-worker";
const PLIST_PATH = join(homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
const NO_LAUNCH = process.argv.includes("--no-launch");

function xml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

mkdirSync(join(STATE_ROOT, "logs"), { recursive: true, mode: 0o700 });
chmodSync(STATE_ROOT, 0o700);

if (!existsSync(SECRET_PATH)) {
  writeFileSync(SECRET_PATH, `${randomBytes(32).toString("hex")}\n`, { mode: 0o600 });
}
chmodSync(SECRET_PATH, 0o600);
if (readFileSync(SECRET_PATH, "utf8").trim().length < 32) {
  throw new Error(`Worker secret is invalid: ${SECRET_PATH}`);
}

mkdirSync(join(INSTALL_ROOT, "scripts", "uzi-worker"), { recursive: true, mode: 0o700 });
copyFileSync(join(PROJECT_ROOT, "scripts", "uzi-local-worker.mjs"), INSTALLED_WORKER_PATH);
copyFileSync(
  join(PROJECT_ROOT, "scripts", "uzi-worker", "private-brief.schema.json"),
  join(INSTALL_ROOT, "scripts", "uzi-worker", "private-brief.schema.json")
);
chmodSync(INSTALLED_WORKER_PATH, 0o700);

const nodePath = process.execPath;
const codexPath = execFileSync("sh", ["-lc", "command -v codex"], { encoding: "utf8" }).trim();
const pathValue = [dirname(nodePath), dirname(codexPath), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].join(":");
const workerId = `mac-${hostname()}`.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 64);
const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xml(nodePath)}</string>
    <string>${xml(INSTALLED_WORKER_PATH)}</string>
  </array>
  <key>WorkingDirectory</key><string>${xml(INSTALL_ROOT)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>${xml(pathValue)}</string>
    <key>ALPHAPERCEPT_WORKER_HOME</key><string>${xml(STATE_ROOT)}</string>
    <key>ALPHAPERCEPT_WORKER_ID</key><string>${xml(workerId)}</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>20</integer>
  <key>StandardOutPath</key><string>${xml(join(STATE_ROOT, "logs", "worker.out.log"))}</string>
  <key>StandardErrorPath</key><string>${xml(join(STATE_ROOT, "logs", "worker.err.log"))}</string>
</dict>
</plist>
`;

mkdirSync(dirname(PLIST_PATH), { recursive: true });
writeFileSync(PLIST_PATH, plist, { mode: 0o600 });

if (!NO_LAUNCH) {
  const service = `gui/${process.getuid()}/${LABEL}`;
  try {
    execFileSync("launchctl", ["bootout", service], { stdio: "ignore" });
  } catch {}
  execFileSync("launchctl", ["bootstrap", `gui/${process.getuid()}`, PLIST_PATH], { stdio: "inherit" });
  execFileSync("launchctl", ["kickstart", "-k", service], { stdio: "inherit" });
}

console.log(`Uzi Worker 已准备：${NO_LAUNCH ? "尚未启动" : "已启动"}`);
console.log(`密钥文件：${SECRET_PATH}（内容未输出）`);
console.log(`服务文件：${PLIST_PATH}`);
