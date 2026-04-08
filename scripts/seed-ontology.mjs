#!/usr/bin/env node
/**
 * Parses the Youtrimers ontology text file and generates a SQL seed file.
 *
 * Usage:
 *   node scripts/seed-ontology.mjs > supabase/migrations/004_ontology_seed.sql
 *
 * File format expected:
 *   TREE|PARENT|CHILD
 *   ALIAS|NODE|alias1|alias2|...
 *   ALIAS|CONTEXTUAL=TRUE|NODE|alias    (stored in metadata.contextual_aliases)
 *   Lines starting with # are comments
 */

import fs from "fs";
import { randomUUID } from "crypto";

const ONTOLOGY_FILE =
  "C:/Users/User/Documents/NUTRIMERS_2026/Ontology/Ontology v1.5 2026_04_08.txt";

// Nodes of these types start as inactive (is_active = false)
const INACTIVE_TYPES = new Set(["DOSAGE_FORM", "TAGS"]);

// ── Parser ────────────────────────────────────────────────────────────────────

const childrenOf = new Map();   // node_name → [child_name, ...]
const parentOf   = new Map();   // node_name → parent_name
const aliasMap   = new Map();   // node_name → [alias, ...]
const contextual = new Map();   // node_name → [alias, ...]  (contextual-only)
const nodeOrder  = [];          // tracks insertion order for sort_order
const nodeSet    = new Set();

function ensureNode(name) {
  if (!nodeSet.has(name)) {
    nodeSet.add(name);
    nodeOrder.push(name);
    childrenOf.set(name, []);
  }
}

const lines = fs.readFileSync(ONTOLOGY_FILE, "utf8").split("\n");

for (const rawLine of lines) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;

  const parts = line.split("|");
  const kind  = parts[0];

  if (kind === "TREE") {
    const parent = parts[1]?.trim();
    const child  = parts[2]?.trim();
    if (!parent || !child) continue;

    ensureNode(parent);
    ensureNode(child);
    childrenOf.get(parent).push(child);
    parentOf.set(child, parent);

  } else if (kind === "ALIAS") {
    if (parts[1]?.trim() === "CONTEXTUAL=TRUE") {
      const node    = parts[2]?.trim();
      const aliases = parts.slice(3).map((a) => a.trim()).filter(Boolean);
      if (node) {
        if (!contextual.has(node)) contextual.set(node, []);
        contextual.get(node).push(...aliases);
      }
    } else {
      const node    = parts[1]?.trim();
      const aliases = parts.slice(2).map((a) => a.trim()).filter(Boolean);
      if (node) {
        if (!aliasMap.has(node)) aliasMap.set(node, []);
        aliasMap.get(node).push(...aliases);
      }
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Walk up the tree to find the top-level type (highest ancestor below ROOT). */
function getType(name) {
  const parent = parentOf.get(name);
  if (!parent || parent === "ROOT") return name;
  return getType(parent);
}

/** Fallback display name: Title Case with underscores → spaces. */
function toDisplayName(nodeName, firstAlias) {
  if (firstAlias) return firstAlias;
  return nodeName
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function escapeSql(str) {
  return str.replace(/'/g, "''");
}

// ── Assign UUIDs ──────────────────────────────────────────────────────────────

const uuidOf = new Map();
for (const name of nodeSet) uuidOf.set(name, randomUUID());

// ── Build INSERT rows ─────────────────────────────────────────────────────────

const rows = [];
let sortOrder = 0;

for (const node of nodeOrder) {
  if (node === "ROOT") { sortOrder++; continue; } // ROOT is virtual, not stored

  const id        = uuidOf.get(node);
  const parentName = parentOf.get(node);
  const parentId  = parentName && parentName !== "ROOT" ? uuidOf.get(parentName) : null;
  const aliases   = aliasMap.get(node)  || [];
  const ctxAliases = contextual.get(node) || [];
  const displayName = toDisplayName(node, aliases[0] || null);
  const type      = getType(node);
  const isLeaf    = childrenOf.get(node).length === 0;
  const isActive  = !INACTIVE_TYPES.has(type);

  const metadata  = ctxAliases.length > 0
    ? JSON.stringify({ contextual_aliases: ctxAliases })
    : null;

  const aliasesSql = aliases.length > 0
    ? `ARRAY[${aliases.map((a) => `'${escapeSql(a)}'`).join(", ")}]`
    : `ARRAY[]::text[]`;

  const parentIdSql  = parentId  ? `'${parentId}'`           : "NULL";
  const metadataSql  = metadata  ? `'${escapeSql(metadata)}'::jsonb` : "NULL";

  rows.push(
    `  ('${id}', '${escapeSql(node)}', ${parentIdSql}, ${aliasesSql}, ` +
    `'${escapeSql(displayName)}', '${escapeSql(type)}', ${isLeaf}, ${isActive}, ${sortOrder}, ${metadataSql})`
  );

  sortOrder++;
}

// ── Output SQL ────────────────────────────────────────────────────────────────

process.stdout.write(
  `-- Auto-generated ontology seed — do not edit manually\n` +
  `-- Source: Ontology v1.5 2026_04_08.txt\n` +
  `-- Nodes: ${rows.length}\n\n` +
  `INSERT INTO public.ontology\n` +
  `  (id, node_name, parent_id, aliases, display_name, type, is_leaf, is_active, sort_order, metadata)\n` +
  `VALUES\n` +
  rows.join(",\n") +
  `\nON CONFLICT (node_name) DO NOTHING;\n`
);
