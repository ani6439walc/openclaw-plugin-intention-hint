/** Keys that indicate sensitive values (case-insensitive, normalized matching) */
const SENSITIVE_KEYS = new Set([
  "token",
  "apiKey",
  "api_key",
  "key",
  "password",
  "secret",
  "authorization",
  "cookie",
  "auth",
  "credential",
  "credentials",
  "access_token",
  "refresh_token",
  "private_key",
  "privatekey",
]);

/** Regex patterns for detecting sensitive string values */
const SENSITIVE_PATTERNS: Array<{ pattern: RegExp }> = [
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi },
  { pattern: /ghp_[A-Za-z0-9]{36}/g },
  { pattern: /github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}/g },
  { pattern: /sk-[A-Za-z0-9]{20,48}/g },
  { pattern: /AKIA[0-9A-Z]{16}/g },
  {
    pattern:
      /eyJ[A-Za-z0-9\-._~+/]+=*\.eyJ[A-Za-z0-9\-._~+/]+=*\.[A-Za-z0-9\-._~+/]+=*/g,
  },
  {
    pattern:
      /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
  },
  { pattern: /[A-Za-z0-9\-._~+/]{64,}={0,2}/g },
];

const REDACTED = "[REDACTED]";

function isSensitiveKey(key: string): boolean {
  const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");
  for (const sensitiveKey of SENSITIVE_KEYS) {
    const normalizedSensitive = sensitiveKey.toLowerCase().replace(/[-_]/g, "");
    if (
      normalizedKey === normalizedSensitive ||
      normalizedKey.includes(normalizedSensitive)
    ) {
      return true;
    }
  }
  return false;
}

function matchesSensitivePattern(value: string): boolean {
  for (const { pattern } of SENSITIVE_PATTERNS) {
    if (pattern.test(value)) {
      return true;
    }
  }
  return false;
}

function redactPatternsInString(value: string): string {
  let result = value;
  for (const { pattern } of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, REDACTED);
  }
  return result;
}

/** Recursively redacts sensitive values in objects, arrays, and strings */
export function redactSecrets(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return redactPatternsInString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item));
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        result[key] = REDACTED;
      } else {
        result[key] = redactSecrets(val);
      }
    }
    return result;
  }

  return redactPatternsInString(String(value));
}

/** Redacts secrets then truncates to max length - main entry point for tool history */
export function redactAndTruncate(
  value: unknown,
  maxLen: number = 500,
): string {
  const redacted = redactSecrets(value);

  if (typeof redacted === "string") {
    return redacted.slice(0, maxLen);
  }

  return JSON.stringify(redacted).slice(0, maxLen);
}

/** Redacts secrets in error message strings */
export function redactErrorMessage(
  error: string | undefined | null,
): string | undefined {
  if (error === null || error === undefined) return undefined;
  return redactPatternsInString(error);
}

/** Redacts params/result/error in tool call records for prompt construction */
export function redactToolCallRecord(record: {
  toolName: string;
  params: string;
  result: string;
  error?: string;
  turnNumber: number;
}): {
  toolName: string;
  params: string;
  result: string;
  error?: string;
  turnNumber: number;
} {
  return {
    toolName: record.toolName,
    params: redactPatternsInString(record.params),
    result: redactPatternsInString(record.result),
    error: record.error ? redactPatternsInString(record.error) : undefined,
    turnNumber: record.turnNumber,
  };
}
