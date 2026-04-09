/**
 * Parses Rules Health Goals Inbal.txt and generates
 * supabase/migrations/011_seed_health_goal_rules.sql
 *
 * Usage:
 *   node scripts/seed-rules.mjs
 *
 * The script:
 *  1. Fetches all relevant ontology IDs from Supabase (goals + nutrients).
 *  2. Parses every RULE_START block.
 *  3. Expands multi-goal criteria into one rule row per goal.
 *  4. Outputs INSERT SQL with ON CONFLICT DO NOTHING for idempotency.
 */

import { readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// ── Config ──────────────────────────────────────────────────────────────────

const RULES_FILE =
  "C:/Users/User/Documents/NUTRIMERS_2026/Rules/Rules Health Goals Inbal.txt";
const OUTPUT_FILE =
  "supabase/migrations/011_seed_health_goal_rules.sql";

// Load env manually (no dotenv dependency)
const envText = readFileSync(".env", "utf-8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);
const SUPABASE_URL = env["VITE_SUPABASE_URL"];
const SUPABASE_KEY = env["VITE_SUPABASE_PUBLISHABLE_KEY"];

// Ingredient names in the rules that differ from ontology node_names
const INGREDIENT_NAME_MAP = {
  OMEGA3_FATTY_ACIDS: "OMEGA_3",
  COENZYME_Q10: "UBIQUINOL",
};

// apply_level → priority integer
const PRIORITY_MAP = {
  require: 1,
  caution: 5,
  recommend: 10,
  extend_conclusion: 50,
};

// ── Supabase fetch helper ────────────────────────────────────────────────────

async function fetchOntologyIds(nodeNames) {
  const https = await import("https");
  const url = new URL(`${SUPABASE_URL}/rest/v1/ontology`);
  url.searchParams.set("node_name", `in.(${nodeNames.join(",")})`);
  url.searchParams.set("select", "node_name,id");

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "GET",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    };
    let body = "";
    const req = https.request(options, (res) => {
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve(JSON.parse(body)));
    });
    req.on("error", reject);
    req.end();
  });
}

// ── Parser ───────────────────────────────────────────────────────────────────

function parseRulesFile(text) {
  const blocks = text.split(/^RULE_START\s*:/m).slice(1); // drop header
  const rules = [];

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    const header = lines[0].trim(); // e.g. "CALCIUM GOAL Rule 1 - Bone health general"

    const criteriaLine = lines.find((l) => l.startsWith("criteria=")) ?? "";
    const explanationLine = lines.find((l) => l.startsWith("explanation=")) ?? "";
    const warningLine = lines.find((l) => l.startsWith("warning=")) ?? "";
    const remarkLine = lines.find((l) => l.startsWith("remark=")) ?? "";

    // ── Parse criteria ──────────────────────────────────────────────────────
    // Format: criteria=(goal:in:G1,G2)|...|action=...|ingredient=...|amount=...|unit=...|...
    // OR:     criteria=(goal:in:G1,G2) AND (condition:xxx)|...

    // Strip additional conditions (AND ...) — stored in metadata
    const [mainCriteria, ...extraConditions] = criteriaLine
      .replace("criteria=", "")
      .split(/\s+AND\s+/);

    const goalMatch = mainCriteria.match(/\(goal:(?:in:)?([^)]+)\)/);
    const goalNames = goalMatch
      ? goalMatch[1].split(",").map((g) => g.trim())
      : [];

    const parts = criteriaLine.split("|");
    const getPart = (key) => {
      const p = parts.find((p) => p.startsWith(`${key}=`));
      return p ? p.slice(key.length + 1) : null;
    };

    const applyLevel = getPart("apply_level") ?? "extend_conclusion";
    const action = getPart("action") ?? "PROVIDE";
    let ingredientName = getPart("ingredient") ?? "";
    const amountRaw = getPart("amount") ?? "(gt:RDA)";
    const unit = getPart("unit") ?? null;

    // ── Resolve ingredient name ─────────────────────────────────────────────
    ingredientName = INGREDIENT_NAME_MAP[ingredientName] ?? ingredientName;

    // ── Parse amount ────────────────────────────────────────────────────────
    const amountMatch = amountRaw.match(/\(gt:([^)]+)\)/);
    const amountVal = amountMatch ? amountMatch[1] : "RDA";
    const numericAmount =
      amountVal === "RDA" ? null : parseFloat(amountVal);

    // ── Build rule ──────────────────────────────────────────────────────────
    rules.push({
      header,
      goalNames,
      applyLevel,
      action, // PROVIDE | AVOID
      ingredientName,
      numericAmount,
      unit: unit ? unit.trim() : null,
      explanation: explanationLine.replace("explanation=", "").trim(),
      warning: warningLine.replace("warning=", "").trim() || null,
      remark: remarkLine.replace("remark=", "").trim() || null,
      extraConditions: extraConditions.map((c) => c.trim()),
    });
  }

  return rules;
}

// ── SQL helpers ──────────────────────────────────────────────────────────────

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function sq(s) {
  if (s === null || s === undefined) return "NULL";
  return `'${String(s).replace(/'/g, "''")}'`;
}

function num(n) {
  return n === null || n === undefined ? "NULL" : String(n);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const text = readFileSync(RULES_FILE, "utf-8");
  const rules = parseRulesFile(text);

  console.log(`Parsed ${rules.length} rule blocks.`);

  // Collect all unique goal and ingredient names
  const allGoalNames = [...new Set(rules.flatMap((r) => r.goalNames))];
  const allIngredientNames = [...new Set(rules.map((r) => r.ingredientName))];

  console.log(`Fetching ontology IDs for ${allGoalNames.length} goals and ${allIngredientNames.length} ingredients...`);

  const allNames = [...new Set([...allGoalNames, ...allIngredientNames])];
  const rows = await fetchOntologyIds(allNames);
  const idByName = new Map(rows.map((r) => [r.node_name, r.id]));

  // Report misses
  const missedGoals = allGoalNames.filter((n) => !idByName.has(n));
  const missedIngredients = allIngredientNames.filter((n) => !idByName.has(n));
  if (missedGoals.length) console.warn("⚠ Goals not found in ontology:", missedGoals);
  if (missedIngredients.length) console.warn("⚠ Ingredients not found in ontology:", missedIngredients);

  // Build SQL
  const lines = [
    "-- Auto-generated by scripts/seed-rules.mjs",
    "-- Source: Rules Health Goals Inbal.txt",
    "-- DO NOT EDIT BY HAND — re-run the script to regenerate.",
    "",
    "-- ── rules ─────────────────────────────────────────────────────────────────",
    "",
  ];

  const ruleInserts = [];
  const actionInserts = [];
  const seenRuleNames = new Set();

  for (const rule of rules) {
    const priority = PRIORITY_MAP[rule.applyLevel] ?? 50;
    const actionType = rule.action === "AVOID" ? "avoid_nutrient" : "require_nutrient";
    const nutrientNodeId = idByName.get(rule.ingredientName);

    const metadata =
      rule.extraConditions.length > 0 || rule.warning
        ? JSON.stringify({
            ...(rule.extraConditions.length > 0 && {
              additional_conditions: rule.extraConditions,
            }),
            ...(rule.warning && { warning: rule.warning }),
            ...(rule.remark && { remark: rule.remark }),
          })
        : null;

    for (const goalName of rule.goalNames) {
      const triggerNodeId = idByName.get(goalName);
      if (!triggerNodeId) {
        console.warn(`  ↳ Skipping goal ${goalName} — not in ontology`);
        continue;
      }

      // rule_name: e.g. "calcium_r1_bone_health"
      const ingredSlug = slug(rule.ingredientName.replace(/_FATTY_ACIDS$/, ""));
      const ruleNumMatch = rule.header.match(/Rule\s+(\d+)/i);
      const ruleNum = ruleNumMatch ? ruleNumMatch[1] : "x";
      const goalSlug = slug(goalName);
      let ruleName = `${ingredSlug}_r${ruleNum}_${goalSlug}`;

      // Ensure uniqueness (shouldn't happen, but guard)
      if (seenRuleNames.has(ruleName)) {
        ruleName += "_b";
      }
      seenRuleNames.add(ruleName);

      const description = rule.explanation.slice(0, 500);

      ruleInserts.push(
        `INSERT INTO public.rules ` +
        `(rule_name, description, trigger_type, trigger_node_id, priority, conflict_strategy, is_active, metadata) VALUES ` +
        `(${sq(ruleName)}, ${sq(description)}, 'goal', '${triggerNodeId}', ${priority}, 'accumulate', true, ${metadata ? sq(metadata) : "NULL"}) ` +
        `ON CONFLICT (rule_name) DO NOTHING;`
      );

      if (nutrientNodeId) {
        // For AVOID rules, put the threshold as max_dose; for PROVIDE, as min_dose
        const minDose = actionType === "require_nutrient" ? rule.numericAmount : null;
        const maxDose = actionType === "avoid_nutrient" ? rule.numericAmount : null;

        actionInserts.push(
          `INSERT INTO public.rule_actions ` +
          `(rule_id, action_type, nutrient_node_id, min_dose, max_dose, unit, dose_priority) ` +
          `SELECT id, ${sq(actionType)}, '${nutrientNodeId}', ${num(minDose)}, ${num(maxDose)}, ${sq(rule.unit)}, ${priority} ` +
          `FROM public.rules WHERE rule_name = ${sq(ruleName)} ` +
          `ON CONFLICT DO NOTHING;`
        );
      } else {
        console.warn(`  ↳ Skipping action for ${ruleName} — ingredient ${rule.ingredientName} not in ontology`);
      }
    }
  }

  lines.push(...ruleInserts);
  lines.push("");
  lines.push("-- ── rule_actions ──────────────────────────────────────────────────────────");
  lines.push("");
  lines.push(...actionInserts);
  lines.push("");

  writeFileSync(OUTPUT_FILE, lines.join("\n"), "utf-8");
  console.log(`\n✓ Written to ${OUTPUT_FILE}`);
  console.log(`  ${ruleInserts.length} rule rows`);
  console.log(`  ${actionInserts.length} rule_action rows`);
}

main().catch((e) => { console.error(e); process.exit(1); });
