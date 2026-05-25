import matter from "gray-matter";

export function extractSkillsFromToolCall(
  toolName: string,
  params: unknown,
  result?: unknown,
  error?: unknown,
): string[] {
  if (error || !isReadTool(toolName)) return [];
  if (
    extractSkillsFromPaths(extractPathCandidates(params).join(" ")).length === 0
  ) {
    return [];
  }

  const skillName = extractSkillNameFromFrontmatter(result);
  return skillName ? [skillName] : [];
}

function normalizeSkillName(name: string): string {
  return name.trim().toLowerCase();
}

function extractSkillsFromPaths(text: string): string[] {
  const skills = new Set<string>();
  const pattern =
    /(?:^|\s|\/|\\|"|')(?:\/)?skills\/([a-zA-Z0-9_-]+)\/SKILL\.md/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const skillName = match[1];
    if (skillName && skillName.length > 0) {
      skills.add(normalizeSkillName(skillName));
    }
  }

  return Array.from(skills);
}

function isReadTool(toolName: string): boolean {
  const normalized = toolName.toLowerCase();
  return normalized === "read" || normalized === "read_file";
}

function extractPathCandidates(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const candidates: string[] = [];

  for (const key of ["path", "filePath", "filepath"] as const) {
    if (typeof record[key] === "string") {
      candidates.push(record[key]);
    }
  }

  if (record.arguments && typeof record.arguments === "object") {
    candidates.push(...extractPathCandidates(record.arguments));
  }

  return candidates;
}

function extractSkillNameFromFrontmatter(value: unknown): string | undefined {
  try {
    const text = extractText(value);
    if (!text) return undefined;
    const name = matter(text).data.name;
    return typeof name === "string" && name.trim()
      ? normalizeSkillName(name)
      : undefined;
  } catch {
    return undefined;
  }
}

function extractText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  for (const key of ["content", "text", "data", "output", "result"] as const) {
    if (typeof record[key] === "string") return record[key];
  }

  return undefined;
}
