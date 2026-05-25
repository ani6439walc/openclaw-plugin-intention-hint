import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export type BacklogEntryType =
  | "missing_intent"
  | "weak_intent"
  | "skill_candidate"
  | "process_gap"
  | "satisfaction_check"
  | "behavior_fix";

export interface BacklogEntry {
  id: string;
  type: BacklogEntryType;
  sessionId: string;
  createdAt: string;
  status: "pending" | "in_progress" | "completed" | "rejected";
  triggerIntent?: string;
  summary: string;
  details?: string;
  triggerData?: Record<string, unknown>;
}

const DEFAULT_BACKLOG_DIR = path.join(process.cwd(), "evolution", "backlog");
const BACKLOG_DIR_ENV = "INTENTION_HINT_BACKLOG_DIR";

function generateHash(input: string, length: number = 6): string {
  return crypto
    .createHash("sha256")
    .update(input)
    .digest("hex")
    .slice(0, length);
}

function generateEntryId(date: Date, sessionId: string): string {
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const sessionSlug = generateHash(sessionId, 6);
  return `IMP-${dateStr}-${sessionSlug}`;
}

function generateFilename(entryId: string): string {
  return `${entryId}.md`;
}

function formatFrontmatter(entry: BacklogEntry): string {
  const frontmatter: Record<string, unknown> = {
    id: entry.id,
    type: entry.type,
    sessionId: entry.sessionId,
    createdAt: entry.createdAt,
    status: entry.status,
    triggerData: entry.triggerData || undefined,
  };

  return toYaml(frontmatter);
}

function toYaml(value: unknown, indent: number = 0): string {
  if (!value || typeof value !== "object") {
    return yamlScalar(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => `${" ".repeat(indent)}- ${yamlValue(item, indent + 2)}`)
      .join("\n");
  }

  return Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined)
    .map(([key, entryValue]) => {
      if (isYamlScalar(entryValue)) {
        return `${" ".repeat(indent)}${key}: ${yamlScalar(entryValue)}`;
      }
      const nested = toYaml(entryValue, indent + 2);
      return `${" ".repeat(indent)}${key}:\n${nested}`;
    })
    .join("\n");
}

function yamlValue(value: unknown, indent: number): string {
  if (isYamlScalar(value)) {
    return yamlScalar(value);
  }

  return `\n${toYaml(value, indent)}`;
}

function isYamlScalar(value: unknown): boolean {
  return (
    value === null || ["string", "number", "boolean"].includes(typeof value)
  );
}

function yamlScalar(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(String(value));
}

function formatMarkdownBody(entry: BacklogEntry): string {
  const lines: string[] = [];

  lines.push("# Improvement Item");
  lines.push("");

  lines.push("## Trigger");
  if (entry.triggerIntent) {
    lines.push(`intent = ${entry.triggerIntent}`);
  } else {
    lines.push(`type = ${entry.type}`);
  }
  lines.push("");

  lines.push("## Summary");
  lines.push(entry.summary);
  lines.push("");

  if (entry.details) {
    lines.push("## Details");
    lines.push(entry.details);
    lines.push("");
  }

  if (entry.triggerData) {
    lines.push("## Trigger Data");
    lines.push("```json");
    lines.push(JSON.stringify(entry.triggerData, null, 2));
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n");
}

function formatEntry(entry: BacklogEntry): string {
  const frontmatter = formatFrontmatter(entry);
  const body = formatMarkdownBody(entry);

  return `---\n${frontmatter}\n---\n\n${body}`;
}

function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function findUniqueFilename(dirPath: string, baseFilename: string): string {
  let filename = baseFilename;
  let counter = 1;
  const ext = path.extname(baseFilename);
  const name = path.basename(baseFilename, ext);

  while (fs.existsSync(path.join(dirPath, filename))) {
    filename = `${name}-${counter}${ext}`;
    counter++;
  }

  return filename;
}

export function writeBacklogEntry(
  entry: Omit<BacklogEntry, "id" | "createdAt">,
  options: { backlogDir?: string } = {},
): string {
  const now = new Date();
  const entryId = generateEntryId(now, entry.sessionId);
  const backlogDir =
    options.backlogDir ?? process.env[BACKLOG_DIR_ENV] ?? DEFAULT_BACKLOG_DIR;

  const fullEntry: BacklogEntry = {
    ...entry,
    id: entryId,
    createdAt: now.toISOString(),
  };

  ensureDirectoryExists(backlogDir);

  const baseFilename = generateFilename(entryId);
  const filename = findUniqueFilename(backlogDir, baseFilename);
  const filePath = path.join(backlogDir, filename);

  const content = formatEntry(fullEntry);
  fs.writeFileSync(filePath, content, "utf-8");

  return entryId;
}
