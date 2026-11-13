#!/usr/bin/env node
/**
 * tests/e2e/runner.js
 * Unified standalone test runner for Smart Achievement Vault & Career Assistant E2E suites.
 */

import { readdirSync, statSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { run } from 'node:test';
import { spec } from 'node:test/reporters';

const E2E_DIR = import.meta.dirname || resolve(process.cwd(), 'tests/e2e');

function findTestFiles(targetTier = null) {
  let files = [];
  try {
    const entries = readdirSync(E2E_DIR);
    files = entries
      .filter((file) => file.endsWith('.test.js'))
      .map((file) => join(E2E_DIR, file));
  } catch (err) {
    console.error(`[Runner Error] Unable to read tests directory: ${err.message}`);
    process.exit(1);
  }

  if (targetTier) {
    const tierFilter = `tier${targetTier}`;
    files = files.filter((f) => basename(f).toLowerCase().includes(tierFilter));
  }

  // If specific files passed as CLI arguments
  const cliArgs = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  if (cliArgs.length > 0) {
    files = cliArgs.map((arg) => resolve(process.cwd(), arg));
  }

  return files;
}

function parseCliTier() {
  const tierArg = process.argv.find((arg) => arg.startsWith('--tier='));
  if (tierArg) {
    return tierArg.split('=')[1].trim();
  }
  return null;
}

async function main() {
  const startTime = Date.now();
  const targetTier = parseCliTier();
  const testFiles = findTestFiles(targetTier);

  console.log('='.repeat(78));
  console.log('🚀 E2E TEST RUNNER — Smart Achievement Vault & Career Assistant');
  console.log(`📁 Test Directory: ${E2E_DIR}`);
  console.log(`🎯 Test Mode:      ${process.env.TEST_MODE || 'auto'}`);
  console.log(`🌐 Base URL:       ${process.env.TEST_API_URL || 'http://localhost:5000'}`);
  console.log(`📦 Discovered Files (${testFiles.length}):`);
  testFiles.forEach((f) => console.log(`   - ${basename(f)}`));
  console.log('='.repeat(78) + '\n');

  if (testFiles.length === 0) {
    console.warn('⚠️ No test files matched the criteria. Exiting.');
    process.exit(0);
  }

  let leafPass = 0;
  let leafFail = 0;
  let suitePass = 0;
  let suiteFail = 0;
  let totalSkipped = 0;

  const testStream = run({
    files: testFiles,
    concurrency: false,
  });

  // Track counts from test stream events
  testStream.on('test:pass', (test) => {
    if (test.details?.type === 'suite') {
      suitePass++;
    } else {
      leafPass++;
    }
  });

  testStream.on('test:fail', (test) => {
    if (test.details?.type === 'suite') {
      suiteFail++;
    } else {
      leafFail++;
    }
  });

  testStream.on('test:skip', () => {
    totalSkipped++;
  });

  // Pipe to standard spec reporter for live terminal output
  testStream.compose(spec).pipe(process.stdout);

  await new Promise((res) => testStream.on('end', res));

  const totalSuites = suitePass + suiteFail;
  const totalPass = leafPass + suitePass;
  const totalFail = leafFail + suiteFail;
  const totalEvents = totalPass + totalFail + totalSkipped;

  const durationMs = Date.now() - startTime;
  const durationSec = (durationMs / 1000).toFixed(2);

  console.log('\n' + '='.repeat(78));
  console.log('📊 E2E EXECUTION METRICS SUMMARY');
  console.log('='.repeat(78));
  console.log(`  Leaf Tests Passed:      ${leafPass}`);
  console.log(`  Suites:                 ${totalSuites}`);
  console.log(`  Total Execution Events: ${totalEvents}`);
  console.log(`  Passed: ${totalPass}, Failed: ${totalFail}, Skipped: ${totalSkipped}`);
  console.log(`  ⏱️ Total Duration:      ${durationSec}s (${durationMs} ms)`);
  console.log('='.repeat(78));

  if (totalFail > 0) {
    console.error(`\n💥 EXECUTION FAILED: ${totalFail} test(s) failed.`);
    process.exit(1);
  } else {
    console.log('\n✨ ALL TESTS COMPLETED SUCCESSFULLY.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('[Runner Fatal Error]', err);
  process.exit(1);
});
