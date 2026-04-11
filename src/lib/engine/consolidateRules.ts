import type {
  FiredRule,
  RuleAction,
  NutrientRequirement,
  ConsolidatedRules,
} from "@/types/engine";

/**
 * Consolidate a flat list of fired rules into a single ConsolidatedRules object.
 *
 * Dose accumulation logic (applies when dose data is present):
 *   min_dose   → max of all minimums (most conservative floor across all goals)
 *   max_dose   → min of all maximums (most restrictive safe ceiling)
 *   preferred  → taken from the rule with the lowest dose_priority integer
 *
 * Conflict resolution:
 *   avoid_nutrient vs require_nutrient for the same nutrient →
 *   the rule with the lower priority integer (higher urgency) wins.
 *
 * Tags: prefer_tag and avoid_tag are unioned; avoid wins over prefer for the same tag.
 */
export function consolidateRules(firedRules: FiredRule[]): ConsolidatedRules {
  // Accumulate per-nutrient data keyed by nutrientNodeId
  const requireMap = new Map<
    string,
    {
      displayName: string | null;
      minDose: number | null;
      maxDose: number | null;
      preferredDose: number | null;
      preferredDosePriority: number;
      unit: string | null;
      weight: number; // 1 / min(rule priority) for this nutrient
      minPriority: number;
      ruleIds: string[];
      descriptions: string[];
    }
  >();

  const avoidSet = new Map<
    string,
    { priority: number; ruleId: string; enforceLevel: 'requirement' | 'recommendation' }
  >();
  const preferredTags = new Set<string>();
  const avoidedTags = new Set<string>();
  const preferredForms = new Set<string>();
  const firedRuleIds: string[] = [];

  for (const rule of firedRules) {
    firedRuleIds.push(rule.ruleId);

    for (const action of rule.actions) {
      switch (action.actionType) {
        case "require_nutrient": {
          if (!action.nutrientNodeId) break;
          const nid = action.nutrientNodeId;
          const existing = requireMap.get(nid);

          if (!existing) {
            requireMap.set(nid, {
              displayName: action.nutrientDisplayName ?? null,
              minDose: action.minDose ?? null,
              maxDose: action.maxDose ?? null,
              preferredDose: action.preferredDose ?? null,
              preferredDosePriority: action.dosePriority,
              unit: action.unit ?? null,
              weight: 1 / rule.priority,
              minPriority: rule.priority,
              ruleIds: [rule.ruleId],
              descriptions: rule.description ? [rule.description] : [],
            });
          } else {
            // Accumulate: max of minimums, min of maximums
            if (action.minDose != null) {
              existing.minDose =
                existing.minDose == null
                  ? action.minDose
                  : Math.max(existing.minDose, action.minDose);
            }
            if (action.maxDose != null) {
              existing.maxDose =
                existing.maxDose == null
                  ? action.maxDose
                  : Math.min(existing.maxDose, action.maxDose);
            }
            // Preferred dose: taken from the action with the lowest dose_priority
            if (
              action.preferredDose != null &&
              action.dosePriority < existing.preferredDosePriority
            ) {
              existing.preferredDose = action.preferredDose;
              existing.preferredDosePriority = action.dosePriority;
              existing.unit = action.unit ?? existing.unit;
            }
            // Weight: use the most important (lowest priority int) rule's weight
            if (rule.priority < existing.minPriority) {
              existing.minPriority = rule.priority;
              existing.weight = 1 / rule.priority;
            }
            existing.ruleIds.push(rule.ruleId);
            if (rule.description && !existing.descriptions.includes(rule.description)) {
              existing.descriptions.push(rule.description);
            }
          }
          break;
        }

        case "avoid_nutrient": {
          if (!action.nutrientNodeId) break;
          const nid = action.nutrientNodeId;
          const existing = avoidSet.get(nid);
          // Escalate to 'requirement' if any rule for this nutrient demands it.
          const newLevel =
            action.enforceLevel === 'requirement' || existing?.enforceLevel === 'requirement'
              ? 'requirement'
              : 'recommendation';
          if (!existing || rule.priority < existing.priority) {
            avoidSet.set(nid, {
              priority: rule.priority,
              ruleId: rule.ruleId,
              enforceLevel: newLevel,
            });
          } else if (newLevel === 'requirement') {
            // Same or lower priority but stricter enforcement — upgrade level only
            existing.enforceLevel = 'requirement';
          }
          break;
        }

        case "prefer_tag":
          if (action.tagNodeId) preferredTags.add(action.tagNodeId);
          break;

        case "avoid_tag":
          if (action.tagNodeId) avoidedTags.add(action.tagNodeId);
          break;

        case "prefer_form":
          if (action.formNodeId) preferredForms.add(action.formNodeId);
          break;
      }
    }
  }

  // Resolve avoid vs require conflicts: lower priority integer wins
  const requirements: NutrientRequirement[] = [];

  for (const [nid, req] of requireMap.entries()) {
    const avoid = avoidSet.get(nid);
    if (avoid && avoid.priority < req.minPriority) {
      // Avoid wins — emit as isRequired=false (avoid signal to scorer)
      requirements.push({
        nutrientNodeId: nid,
        nutrientDisplayName: req.displayName,
        minDose: null,
        maxDose: null,
        preferredDose: null,
        unit: null,
        isRequired: false,
        enforceLevel: avoid.enforceLevel,
        weight: 1 / avoid.priority,
        contributingRuleIds: [avoid.ruleId],
        contributingRuleDescriptions: [],
      });
      avoidSet.delete(nid); // consumed
    } else {
      // Require wins (or no conflict)
      if (req.minDose != null && req.maxDose != null && req.minDose > req.maxDose) {
        console.warn(
          `[consolidateRules] min_dose > max_dose for nutrient ${nid}. Clamping min to max.`
        );
        req.minDose = req.maxDose;
      }
      requirements.push({
        nutrientNodeId: nid,
        nutrientDisplayName: req.displayName,
        minDose: req.minDose,
        maxDose: req.maxDose,
        preferredDose: req.preferredDose,
        unit: req.unit,
        isRequired: true,
        enforceLevel: 'recommendation', // not applicable for required nutrients
        weight: req.weight,
        contributingRuleIds: req.ruleIds,
        contributingRuleDescriptions: req.descriptions,
      });
      avoidSet.delete(nid);
    }
  }

  // Any remaining avoid entries (not countered by a require)
  for (const [nid, avoid] of avoidSet.entries()) {
    requirements.push({
      nutrientNodeId: nid,
      nutrientDisplayName: null,
      minDose: null,
      maxDose: null,
      preferredDose: null,
      unit: null,
      isRequired: false,
      enforceLevel: avoid.enforceLevel,
      weight: 1 / avoid.priority,
      contributingRuleIds: [avoid.ruleId],
      contributingRuleDescriptions: [],
    });
  }

  // Tags: avoid wins over prefer for the same tag
  for (const tagId of avoidedTags) preferredTags.delete(tagId);

  return {
    requirements,
    preferredTagNodeIds: [...preferredTags],
    avoidedTagNodeIds: [...avoidedTags],
    preferredFormNodeIds: [...preferredForms],
    firedRuleIds: [...new Set(firedRuleIds)],
  };
}

/**
 * Group raw RPC rows into FiredRule objects.
 * The RPC returns one row per (rule × action); this re-assembles them.
 */
export function groupRpcRowsIntoFiredRules(
  rows: Array<{
    rule_id: string;
    rule_name: string;
    rule_description: string | null;
    trigger_node_id: string;
    priority: number;
    conflict_strategy: string;
    action_id: string;
    action_type: string;
    nutrient_node_id: string | null;
    nutrient_display_name: string | null;
    tag_node_id: string | null;
    form_node_id: string | null;
    min_dose: number | null;
    max_dose: number | null;
    preferred_dose: number | null;
    unit: string | null;
    dose_priority: number;
    enforce_level: string | null;
  }>
): FiredRule[] {
  const ruleMap = new Map<string, FiredRule>();

  for (const row of rows) {
    let rule = ruleMap.get(row.rule_id);
    if (!rule) {
      rule = {
        ruleId: row.rule_id,
        ruleName: row.rule_name,
        description: row.rule_description ?? null,
        triggerNodeId: row.trigger_node_id,
        priority: row.priority,
        conflictStrategy: row.conflict_strategy as FiredRule["conflictStrategy"],
        actions: [],
      };
      ruleMap.set(row.rule_id, rule);
    }

    const action: RuleAction = {
      actionId: row.action_id,
      actionType: row.action_type as RuleAction["actionType"],
      nutrientNodeId: row.nutrient_node_id ?? undefined,
      nutrientDisplayName: row.nutrient_display_name ?? undefined,
      tagNodeId: row.tag_node_id ?? undefined,
      formNodeId: row.form_node_id ?? undefined,
      minDose: row.min_dose,
      maxDose: row.max_dose,
      preferredDose: row.preferred_dose,
      unit: row.unit,
      dosePriority: row.dose_priority,
      enforceLevel: row.enforce_level === 'requirement' ? 'requirement' : 'recommendation',
    };
    rule.actions.push(action);
  }

  return [...ruleMap.values()];
}
