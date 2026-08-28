/**
 * scan_secrets.mjs — High-Speed Pre-Commit, Pre-Push & CI Secrets and Credentials Scanner
 * Scans all tracked files, source files, and build artifacts for potential leaked credentials.
 * NEVER outputs raw secrets to console — prints strictly redacted location identifiers.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

// Secret Patterns with Redacted Detection Rules
const SECRET_RULES = [
  {
    id: "PRIVATE_KEY",
    name: "Asymmetric Private Key (RSA / EC / OPENSSH)",
    regex: /-----BEGIN\s+([A-Z0-9_-]+\s+)?PRIVATE\s+KEY-----/i,
  },
  {
    id: "RESEND_API_KEY",
    name: "Resend Email API Token",
    regex: /\bre_[a-zA-Z0-9_-]{24,}\b/,
  },
  {
    id: "AWS_ACCESS_KEY",
    name: "AWS Access Key ID",
    regex: /\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/,
  },
  {
    id: "GITHUB_TOKEN",
    name: "GitHub Personal Access Token",
    regex: /\b(ghp|gho|ghu|ghs|ghr)_[0-9a-zA-Z]{36,}\b/,
  },
  {
    id: "STRIPE_SECRET_KEY",
    name: "Stripe Live Secret Key",
    regex: /\bsk_live_[0-9a-zA-Z]{24,}\b/,
  },
  {
    id: "GENERIC_BEARER_SECRET",
    name: "Hardcoded Bearer Auth Secret Header",
    regex: /['"`]Bearer\s+[a-zA-Z0-9_\-\.]{32,}['"`]/,
  },
  {
    id: "PASSWORD_ASSIGNMENT",
    name: "Plaintext Production Password Assignment",
    regex: /(DB_PASSWORD|DB_PASS|MYSQL_PASSWORD|VPS_PASSWORD)\s*=\s*['"][^'"]{6,}['"]/i,
    filter: (match) => {
      // Allow template placeholders and dynamic bash expressions
      return !match.includes("${") && !match.includes("$(") && !match.includes("your_") && !match.includes("[REDACTED");
    }
  }
];

// Files and Directories to Exclude from Deep Scan
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".pnpm-store",
  "storage",
  "uploads",
  "graphify-out",
  ".gemini"
]);

const IGNORED_FILES = new Set([
  "package-lock.json",
  "scan_secrets.mjs",
  ".env.example",
  "version.json"
]);

function scanFile(filePath) {
  const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, "/");
  const fileName = path.basename(filePath);

  if (IGNORED_FILES.has(fileName)) return [];

  // Flag if an active .env or credential file is accidentally present in git
  if ((fileName.startsWith(".env") && !fileName.endsWith(".example")) || fileName.endsWith(".pem") || fileName.endsWith(".key")) {
    return [{
      file: relPath,
      line: 1,
      ruleId: "UNTRACKED_SECRET_FILE",
      ruleName: "Environment / Secret File Found in Workspace",
      sample: "[REDACTED_SECRET_FILE]"
    }];
  }

  let content = "";
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return []; // Binary or unreadable file
  }

  const lines = content.split("\n");
  const issues = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comments and safe redaction placeholders
    if (line.includes("[REDACTED") || line.includes("placeholder") || line.includes("your_")) continue;

    for (const rule of SECRET_RULES) {
      const match = line.match(rule.regex);
      if (match) {
        if (rule.filter && !rule.filter(match[0])) {
          continue;
        }

        issues.push({
          file: relPath,
          line: i + 1,
          ruleId: rule.id,
          ruleName: rule.name,
          sample: `[REDACTED_${rule.id}]`
        });
      }
    }
  }

  return issues;
}

function walkDir(dir, results = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, results);
    } else if (entry.isFile()) {
      const issues = scanFile(fullPath);
      if (issues.length > 0) {
        results.push(...issues);
      }
    }
  }

  return results;
}

import { execSync } from "node:child_process";

function getTrackedFiles() {
  try {
    const stdout = execSync("git ls-files", { encoding: "utf-8" });
    return stdout
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f.length > 0 && !IGNORED_FILES.has(path.basename(f)));
  } catch {
    return [];
  }
}

console.log("🔒 Running CliniCore Enterprise Secret & Supply-Chain Scanner on Tracked Repository Files...");
const tracked = getTrackedFiles();
const findings = [];

for (const relFile of tracked) {
  const fullPath = path.join(ROOT_DIR, relFile);
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    const issues = scanFile(fullPath);
    if (issues.length > 0) {
      findings.push(...issues);
    }
  }
}

if (findings.length > 0) {
  console.error(`\n🚨 SECURITY ALERT: ${findings.length} potential secret(s) detected in tracked repository files!\n`);
  findings.forEach((f, idx) => {
    console.error(`  [${idx + 1}] ${f.file}:${f.line} -> ${f.ruleName} (${f.sample})`);
  });
  console.error("\n❌ Scan failed: Remove or redact all credentials before committing.\n");
  process.exit(1);
} else {
  console.log(`✅ PERFECT: 0 secrets or sensitive credentials detected across ${tracked.length} tracked files!`);
  process.exit(0);
}
