import type { DependencyChange, SyncPlan } from "./sync-plan"

function formatDependencyChanges(changes: DependencyChange[]): string[] {
  if (changes.length === 0) return ["- none"]
  return changes.map(
    (change) =>
      `- ${change.item}: ${change.removed.join(", ") || "none"} -> ${change.added.join(", ") || "none"}`,
  )
}

function formatDigestChanges(plan: SyncPlan): string[] {
  if (plan.summary.digests.length === 0) return ["- none"]
  return plan.summary.digests.map(
    (change) => `- ${change.item}: ${change.previous ?? "new"} -> ${change.next}`,
  )
}

/**
 * Renders a deterministic, human-readable review report for a sync plan.
 * Every section is always printed, even when it has no entries, so the
 * report can be diffed or pasted into a PR as-is.
 */
export function formatSyncReport(plan: SyncPlan): string {
  return [
    `Source: ${plan.sourceId}`,
    `Added files: ${plan.summary.added}`,
    `Changed files: ${plan.summary.changed}`,
    `Removed files: ${plan.summary.removed}`,
    "NPM dependency changes:",
    ...formatDependencyChanges(plan.summary.npmDependencies),
    "Registry dependency changes:",
    ...formatDependencyChanges(plan.summary.registryDependencies),
    "Digest changes:",
    ...formatDigestChanges(plan),
  ].join("\n")
}
