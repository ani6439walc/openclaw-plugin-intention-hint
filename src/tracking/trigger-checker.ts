import type { IntentionResult } from "../types.js";
import {
  classifyUserText,
  type KeywordClassification,
} from "./keyword-helper.js";

export type TriggerType =
  | "skill_candidate"
  | "process_gap"
  | "missing_intent"
  | "weak_intent"
  | "satisfaction_check"
  | "behavior_fix";

export { type KeywordClassification };

export type TriggerThresholds = {
  satisfactionCheckInterval: number;
  toolCallCountThreshold: number;
  skillsUsedThreshold: number;
  failureCountThreshold: number;
  weakIntentConfidenceThreshold: number;
};

export type SessionEvolutionState = {
  turnCount: number;
  toolCallCount: number;
  toolFailCount: number;
  usedSkills: Set<string>;
  triggeredReviews: Set<TriggerType>;
};

export function checkNonLLMTriggers(
  state: SessionEvolutionState,
  intentResult: IntentionResult | null,
  thresholds: TriggerThresholds,
): TriggerType | null {
  if (!state.triggeredReviews.has("skill_candidate")) {
    if (state.toolCallCount > thresholds.toolCallCountThreshold) {
      return "skill_candidate";
    }

    if (state.usedSkills.size > thresholds.skillsUsedThreshold) {
      return "skill_candidate";
    }
  }

  if (
    !state.triggeredReviews.has("process_gap") &&
    state.toolFailCount >= thresholds.failureCountThreshold
  ) {
    return "process_gap";
  }

  if (intentResult) {
    if (
      !state.triggeredReviews.has("missing_intent") &&
      intentResult.intent === "OTHER"
    ) {
      return "missing_intent";
    }

    if (
      !state.triggeredReviews.has("weak_intent") &&
      intentResult.confidence < thresholds.weakIntentConfidenceThreshold
    ) {
      return "weak_intent";
    }
  }

  return null;
}

/**
 * Check for keyword-based triggers from user text.
 * Returns the trigger type if a keyword pattern is matched, null otherwise.
 *
 * Priority:
 * 1. behavior_fix (highest priority - explicit instruction to change behavior)
 * 2. satisfaction_check (from keyword, lower priority than periodic check)
 */
export function checkKeywordTriggers(
  state: SessionEvolutionState,
  userText: string,
): TriggerType | null {
  const classification = classifyUserText(userText);

  // behavior_fix has highest priority among keyword triggers
  if (classification === "behavior_fix") {
    if (!state.triggeredReviews.has("behavior_fix")) {
      return "behavior_fix";
    }
  }

  // satisfaction from keyword is lower priority than periodic check
  // but can still trigger if not already triggered
  if (classification === "satisfaction") {
    if (!state.triggeredReviews.has("satisfaction_check")) {
      return "satisfaction_check";
    }
  }

  return null;
}

/**
 * Check for periodic LLM review triggers.
 * This is separate from keyword-based satisfaction_check.
 */
export function shouldTriggerLLMReview(
  state: SessionEvolutionState,
  thresholds: TriggerThresholds,
): TriggerType | null {
  if (
    !state.triggeredReviews.has("satisfaction_check") &&
    state.turnCount > 0 &&
    state.turnCount % thresholds.satisfactionCheckInterval === 0
  ) {
    return "satisfaction_check";
  }

  return null;
}
