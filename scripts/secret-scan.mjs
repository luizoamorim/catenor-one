#!/usr/bin/env node
// Secret-scan stub (TASKS T1.4): scans git-tracked and untracked-but-not-ignored files for
// credential-shaped strings. It is a guard rail, not a replacement for a dedicated scanner.
// Findings print file:line and a label only — never the matched value.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const NUL = String.fromCharCode(0);

const PATTERNS = [
  ['private key block', /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/],
  ['Sumsub app token', /\b(?:sbx|prd):[A-Za-z0-9]{20,}/],
  ['Privy app secret', /\bprivy_app_secret_[A-Za-z0-9]{16,}/],
  ['Privy authorization key', /\bwallet-auth:[A-Za-z0-9+/]{16,}/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  // Skips obvious documentation placeholders (YOUR_…, <…>, ${…}, xxxx, changeme, example).
  [
    'assigned secret-like variable',
    /^[A-Z0-9_]*(?:SECRET|TOKEN|PRIVATE_KEY|API_KEY)=(?!YOUR|your|<|\$\{|x{4,}|changeme|example)\S{8,}/,
  ],
];
const FORBIDDEN_PATHS = [/(^|\/)\.env(\.[^/]*)?$/, /(^|\/)scratch\//];
const ALLOWED_PATHS = [/(^|\/)\.env\.example$/];

const files = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  {
    encoding: 'utf8',
  },
)
  .split(NUL)
  .filter(Boolean);

const findings = [];
for (const file of files) {
  if (FORBIDDEN_PATHS.some((re) => re.test(file)) && !ALLOWED_PATHS.some((re) => re.test(file))) {
    findings.push(`${file}: forbidden path is tracked`);
  }
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  if (text.includes(NUL)) continue; // binary file
  text.split('\n').forEach((line, i) => {
    for (const [label, re] of PATTERNS) {
      if (re.test(line)) findings.push(`${file}:${i + 1}: ${label}`);
    }
  });
}

if (findings.length) {
  console.error(`secret-scan: ${findings.length} finding(s)\n${findings.join('\n')}`);
  process.exit(1);
}
console.log(`secret-scan: ${files.length} files scanned, no findings`);
