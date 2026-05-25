/**
 * Conservative satisfaction/correction keyword helper.
 * Classifies user text into: satisfaction, correction, behavior_fix, or none.
 * Uses explicit phrase matching only - no fuzzy LLM calls.
 * Supports Traditional Chinese and English cues.
 */

export type KeywordClassification =
  | "satisfaction"
  | "correction"
  | "behavior_fix"
  | "none";

// Satisfaction phrases - user is happy with result
const SATISFACTION_PHRASES: string[] = [
  // Traditional Chinese
  "可以了",
  "很好",
  "讚",
  "謝啦",
  "完美",
  "沒問題",
  "ok",
  "好的",
  "感謝",
  "謝謝",
  "不錯",
  "很棒",
  "太好了",
  "沒錯",
  "對的",
  "正確",
  "這樣就好",
  "這樣可以",
  "沒錯了",
  "ok了",
  "搞定",
  "完成了",
  "沒問題了",
  // English
  "looks good",
  "works now",
  "works",
  "great",
  "perfect",
  "thanks",
  "thank you",
  "good",
  "nice",
  "awesome",
  "excellent",
  "ok",
  "okay",
  "fine",
  "correct",
  "that's right",
  "that is right",
  "that's correct",
  "that is correct",
  "all good",
  "working now",
  "fixed",
  "solved",
  "done",
  "complete",
  "completed",
];

// Correction phrases - user is correcting/clarifying
const CORRECTION_PHRASES: string[] = [
  // Traditional Chinese
  "不是這樣",
  "你誤會了",
  "剛剛錯了",
  "搞錯了",
  "錯了",
  "不對",
  "不對喔",
  "不對啊",
  "錯誤",
  "更正",
  "應該是",
  "其實是",
  "我的意思是",
  "我指的是",
  "我說的是",
  "誤解",
  "理解錯了",
  "搞錯了",
  "弄錯了",
  // English
  "wrong",
  "not right",
  "incorrect",
  "mistake",
  "misunderstood",
  "you misunderstood",
  "not what i meant",
  "that's not what i meant",
  "that is not what i meant",
  "i meant",
  "i actually meant",
  "what i meant was",
  "actually",
  "correction",
  "to clarify",
  "clarifying",
  "let me clarify",
  "let me rephrase",
  "rephrase",
  "rephrasing",
  "i said wrong",
  "i was wrong",
  "that's wrong",
  "that is wrong",
  "not correct",
  "you got it wrong",
];

// Behavior fix phrases - user is instructing to change behavior
const BEHAVIOR_FIX_PHRASES: string[] = [
  // Traditional Chinese
  "以後不要",
  "下次應該",
  "以後應該",
  "下次不要",
  "以後請",
  "下次請",
  "以後記得",
  "下次記得",
  "以後要",
  "下次要",
  "以後別",
  "下次別",
  "以後請勿",
  "下次請勿",
  "以後避免",
  "下次避免",
  "以後改用",
  "下次改用",
  "請改用",
  "應該要",
  "應該用",
  "建議用",
  "建議使用",
  "請使用",
  "請改用",
  // English
  "don't do that",
  "do not do that",
  "stop doing",
  "please don't",
  "please do not",
  "next time",
  "in the future",
  "from now on",
  "going forward",
  "should use",
  "should be",
  "please use",
  "please don't use",
  "please do not use",
  "avoid",
  "avoid doing",
  "instead of",
  "rather than",
  "use instead",
  "prefer",
  "try using",
  "consider using",
  "you should",
  "i'd prefer",
  "i would prefer",
  "can you use",
  "could you use",
  "switch to",
];

/**
 * Normalize text for matching:
 * - Convert to lowercase
 * - Remove extra whitespace
 * - Trim
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Check if text contains any of the given phrases (case-insensitive).
 * For short ASCII-only phrases (1-2 chars), requires word boundaries.
 * Returns the matched phrase if found, null otherwise.
 */
function findMatchingPhrase(text: string, phrases: string[]): string | null {
  const normalized = normalizeText(text);
  for (const phrase of phrases) {
    const lowerPhrase = phrase.toLowerCase();
    // For short ASCII-only phrases (1-2 chars), require word boundaries to avoid false matches
    // e.g., "ok" should not match "broke", but "很好" should match "很好"
    if (lowerPhrase.length <= 2 && isAsciiOnly(lowerPhrase)) {
      // Use word boundary regex for short ASCII phrases
      const regex = new RegExp(`\\b${escapeRegex(lowerPhrase)}\\b`, "i");
      if (regex.test(normalized)) {
        return phrase;
      }
    } else {
      // For longer phrases or non-ASCII, use simple includes
      if (normalized.includes(lowerPhrase)) {
        return phrase;
      }
    }
  }
  return null;
}

/**
 * Check if a string contains only ASCII characters.
 */
function isAsciiOnly(str: string): boolean {
  return /^[\x00-\x7F]+$/.test(str);
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Classify user text based on conservative keyword matching.
 *
 * Priority:
 * 1. behavior_fix (highest - explicit instruction to change behavior)
 * 2. correction (user correcting/clarifying)
 * 3. satisfaction (user expressing satisfaction)
 * 4. none (no match)
 *
 * @param text - The user text to classify
 * @returns The classification result
 */
export function classifyUserText(text: string): KeywordClassification {
  if (!text || text.trim().length === 0) {
    return "none";
  }

  // Check behavior_fix first (highest priority - explicit instruction)
  if (findMatchingPhrase(text, BEHAVIOR_FIX_PHRASES)) {
    return "behavior_fix";
  }

  // Check correction next
  if (findMatchingPhrase(text, CORRECTION_PHRASES)) {
    return "correction";
  }

  // Check satisfaction last
  if (findMatchingPhrase(text, SATISFACTION_PHRASES)) {
    return "satisfaction";
  }

  return "none";
}

/**
 * Check if text indicates satisfaction.
 * Convenience wrapper around classifyUserText.
 */
export function isSatisfaction(text: string): boolean {
  return classifyUserText(text) === "satisfaction";
}

/**
 * Check if text indicates correction.
 * Convenience wrapper around classifyUserText.
 */
export function isCorrection(text: string): boolean {
  return classifyUserText(text) === "correction";
}

/**
 * Check if text indicates behavior fix instruction.
 * Convenience wrapper around classifyUserText.
 */
export function isBehaviorFix(text: string): boolean {
  return classifyUserText(text) === "behavior_fix";
}
