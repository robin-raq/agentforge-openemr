import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { chat } from "../src/agent";

interface TestCase {
  id: string;
  query: string;
  patient_id?: string;
  expected_tools: string[];
  must_contain: string[];
  must_not_contain: string[];
  category?: string;
  subcategory?: string;
  difficulty?: string;
}

interface EvalResult {
  id: string;
  pass: boolean;
  failures: string[];
  tools_used: string[];
  duration_ms: number;
  category?: string;
  subcategory?: string;
  difficulty?: string;
}

async function runEval() {
  const casesPath = path.join(__dirname, "test-cases.json");
  const resultsPath = path.join(__dirname, "results.json");
  const cases: TestCase[] = JSON.parse(fs.readFileSync(casesPath, "utf-8"));

  // --resume: load previous results and skip cases that already passed
  const resume = process.argv.includes("--resume");
  let previousResults: EvalResult[] = [];
  const skipIds = new Set<string>();

  if (resume && fs.existsSync(resultsPath)) {
    const prev = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
    previousResults = prev.results || [];
    for (const r of previousResults) {
      if (r.pass) skipIds.add(r.id);
    }
    console.log(`📂 Resuming: ${skipIds.size} previously passed cases will be skipped\n`);
  }

  const results: EvalResult[] = [];
  let passed = 0;
  let skipped = 0;
  const suiteStart = Date.now();

  for (const tc of cases) {
    // Skip previously passed cases in resume mode
    if (skipIds.has(tc.id)) {
      const prev = previousResults.find((r) => r.id === tc.id)!;
      results.push(prev);
      passed++;
      skipped++;
      console.log(`⏭️  ${tc.id}: SKIP (previously passed)`);
      continue;
    }

    const failures: string[] = [];
    const start = Date.now();

    try {
      const result = await chat(tc.query, `eval-${tc.id}`, []);
      const toolsUsed = result.toolCalls.map((t) => t.name);
      const responseLower = result.response.toLowerCase();
      const duration_ms = Date.now() - start;

      // Check expected tools were called
      if (tc.expected_tools.length > 0) {
        const missing = tc.expected_tools.filter(
          (t) => !toolsUsed.some((u) => u.toLowerCase().includes(t.toLowerCase()))
        );
        if (missing.length > 0) {
          failures.push(`missing tools: ${missing.join(", ")} (got: ${toolsUsed.join(", ") || "none"})`);
        }
      }

      // Check must_contain
      for (const keyword of tc.must_contain) {
        if (!responseLower.includes(keyword.toLowerCase())) {
          failures.push(`must_contain missing: "${keyword}"`);
        }
      }

      // Check must_not_contain
      for (const keyword of tc.must_not_contain) {
        if (responseLower.includes(keyword.toLowerCase())) {
          failures.push(`must_not_contain found: "${keyword}"`);
        }
      }

      const pass = failures.length === 0;
      if (pass) passed++;

      results.push({
        id: tc.id,
        pass,
        failures,
        tools_used: toolsUsed,
        duration_ms,
        category: tc.category,
        subcategory: tc.subcategory,
        difficulty: tc.difficulty,
      });

      const tag = tc.category ? ` [${tc.category}/${tc.subcategory}]` : " [golden_set]";
      console.log(`${pass ? "✅" : "❌"} ${tc.id}${tag}: ${pass ? "PASS" : failures.join("; ")} (${(duration_ms / 1000).toFixed(1)}s)`);
    } catch (err) {
      const duration_ms = Date.now() - start;
      const errMsg = err instanceof Error ? err.message : String(err);

      // Detect credit/API errors and stop early
      if (errMsg.includes("credit balance is too low") || errMsg.includes("rate_limit")) {
        console.error(`\n⚠️  API error: ${errMsg.substring(0, 100)}`);
        console.error(`Stopping eval at case ${results.length + 1}/${cases.length} — resolve API issue and re-run with --resume.`);
        break;
      }

      failures.push(errMsg);
      results.push({
        id: tc.id,
        pass: false,
        failures,
        tools_used: [],
        duration_ms,
        category: tc.category,
        subcategory: tc.subcategory,
        difficulty: tc.difficulty,
      });
      console.log(`❌ ${tc.id}: ERROR - ${failures[0]} (${(duration_ms / 1000).toFixed(1)}s)`);
    }
  }

  const totalDuration = Date.now() - suiteStart;

  // Summary
  const goldenSets = results.filter((r) => r.id.startsWith("gs-"));
  const scenarios = results.filter((r) => !r.id.startsWith("gs-"));
  const goldenPassed = goldenSets.filter((r) => r.pass).length;
  const scenarioPassed = scenarios.filter((r) => r.pass).length;

  console.log("\n═══════════════════════════════════════");
  console.log("           EVAL RESULTS SUMMARY");
  console.log("═══════════════════════════════════════");
  console.log(`Golden Sets:       ${goldenPassed}/${goldenSets.length} passed`);
  console.log(`Labeled Scenarios: ${scenarioPassed}/${scenarios.length} passed`);
  console.log(`Total:             ${passed}/${results.length} passed (${((passed / results.length) * 100).toFixed(1)}%)`);
  if (skipped > 0) console.log(`Skipped (resume):  ${skipped} cases`);
  console.log(`Duration:          ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`Avg per case:      ${(totalDuration / 1000 / Math.max(results.length - skipped, 1)).toFixed(1)}s (excluding skipped)`);

  // Breakdown by category
  const byCategory = new Map<string, { pass: number; total: number }>();
  for (const r of results) {
    const cat = r.category || "golden_set";
    const entry = byCategory.get(cat) || { pass: 0, total: 0 };
    entry.total++;
    if (r.pass) entry.pass++;
    byCategory.set(cat, entry);
  }

  console.log("\nCategory breakdown:");
  for (const [cat, { pass: p, total }] of byCategory) {
    const pct = ((p / total) * 100).toFixed(0);
    const bar = "█".repeat(Math.round((p / total) * 20)) + "░".repeat(20 - Math.round((p / total) * 20));
    console.log(`  ${cat.padEnd(30)} ${bar} ${p}/${total} (${pct}%)`);
  }

  // Latency stats (exclude skipped)
  const durations = results.filter((r) => r.duration_ms > 0).map((r) => r.duration_ms).sort((a, b) => a - b);
  if (durations.length > 0) {
    const p50 = durations[Math.floor(durations.length * 0.5)];
    const p95 = durations[Math.floor(durations.length * 0.95)];
    console.log(`\nLatency: p50=${(p50 / 1000).toFixed(1)}s  p95=${(p95 / 1000).toFixed(1)}s`);
  }

  // Save results JSON
  const summary = {
    timestamp: new Date().toISOString(),
    total_cases: results.length,
    total_passed: passed,
    pass_rate: ((passed / results.length) * 100).toFixed(1) + "%",
    duration_s: (totalDuration / 1000).toFixed(1),
    avg_latency_s: (totalDuration / 1000 / Math.max(results.length - skipped, 1)).toFixed(1),
    p50_latency_s: durations.length > 0 ? (durations[Math.floor(durations.length * 0.5)] / 1000).toFixed(1) : "N/A",
    p95_latency_s: durations.length > 0 ? (durations[Math.floor(durations.length * 0.95)] / 1000).toFixed(1) : "N/A",
    categories: Object.fromEntries(byCategory),
    results,
  };
  fs.writeFileSync(resultsPath, JSON.stringify(summary, null, 2));
  console.log(`\nResults saved to ${resultsPath}`);

  return summary;
}

runEval().catch(console.error);
