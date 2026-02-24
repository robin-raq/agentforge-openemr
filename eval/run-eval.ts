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
  // Labeled scenario tags (optional — golden sets don't have them)
  category?: string;
  subcategory?: string;
  difficulty?: string;
}

interface EvalResult {
  id: string;
  pass: boolean;
  failures: string[];
  tools_used: string[];
  // Tags echoed back for filtering/reporting
  category?: string;
  subcategory?: string;
  difficulty?: string;
}

async function runEval() {
  const casesPath = path.join(__dirname, "test-cases.json");
  const cases: TestCase[] = JSON.parse(fs.readFileSync(casesPath, "utf-8"));

  const results: EvalResult[] = [];
  let passed = 0;

  for (const tc of cases) {
    const failures: string[] = [];

    try {
      const result = await chat(tc.query, `eval-${tc.id}`, []);
      const toolsUsed = result.toolCalls.map((t) => t.name);
      const responseLower = result.response.toLowerCase();

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
        category: tc.category,
        subcategory: tc.subcategory,
        difficulty: tc.difficulty,
      });

      const tag = tc.category ? ` [${tc.category}/${tc.subcategory}]` : " [golden_set]";
      console.log(`${pass ? "✅" : "❌"} ${tc.id}${tag}: ${pass ? "PASS" : failures.join("; ")}`);
    } catch (err) {
      failures.push(err instanceof Error ? err.message : String(err));
      results.push({
        id: tc.id,
        pass: false,
        failures,
        tools_used: [],
        category: tc.category,
        subcategory: tc.subcategory,
        difficulty: tc.difficulty,
      });
      console.log(`❌ ${tc.id}: ERROR - ${failures[0]}`);
    }
  }

  // Summary
  const goldenSets = results.filter((r) => r.id.startsWith("gs-"));
  const scenarios = results.filter((r) => r.id.startsWith("sc-"));
  const goldenPassed = goldenSets.filter((r) => r.pass).length;
  const scenarioPassed = scenarios.filter((r) => r.pass).length;

  console.log("\n--- RESULTS ---");
  console.log(`Golden Sets:       ${goldenPassed}/${goldenSets.length} passed`);
  console.log(`Labeled Scenarios: ${scenarioPassed}/${scenarios.length} passed`);
  console.log(`Total:             ${passed}/${cases.length} passed`);

  // Breakdown by scenario tags
  if (scenarios.length > 0) {
    const byCategory = new Map<string, { pass: number; total: number }>();
    for (const r of scenarios) {
      const cat = r.category || "untagged";
      const entry = byCategory.get(cat) || { pass: 0, total: 0 };
      entry.total++;
      if (r.pass) entry.pass++;
      byCategory.set(cat, entry);
    }
    console.log("\nScenario breakdown:");
    for (const [cat, { pass: p, total }] of byCategory) {
      console.log(`  ${cat}: ${p}/${total}`);
    }
  }

  return { passed, total: cases.length, results };
}

runEval().catch(console.error);
