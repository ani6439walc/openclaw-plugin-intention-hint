import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import {
  extractReferencedSkillNames,
  resolveAvailableSkills,
} from "./skill-catalog.js";
import type { OpenClawPluginApi } from "../api.js";

function writeSkill(root: string, name: string, description: string): void {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`,
  );
}

describe("skill catalog", () => {
  it("extracts unique skill references from intent markdown", () => {
    expect(
      extractReferencedSkillNames(
        "Use skill: architecture-diagram and skill: test-driven-development. Again skill: architecture-diagram.",
      ),
    ).toEqual(["architecture-diagram", "test-driven-development"]);
  });

  it("loads referenced skills from workspace, personal, and bundled roots", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ih-skills-"));
    const workspace = path.join(tmp, "workspace");
    const state = path.join(tmp, "state");
    const bundled = path.join(tmp, "bundled");

    writeSkill(
      path.join(workspace, "skills"),
      "agent-orchestration",
      "Workspace orchestration.",
    );
    writeSkill(path.join(state, "skills"), "analysis", "Personal analysis.");
    writeSkill(bundled, "blogwatcher", "Bundled blog watcher.");
    writeSkill(
      path.join(state, "skills"),
      "agent-orchestration",
      "Shadowed personal copy.",
    );

    const api = {
      config: {},
      runtime: {
        state: { resolveStateDir: () => state },
        agent: { resolveAgentWorkspaceDir: () => workspace },
      },
    } as unknown as OpenClawPluginApi;

    expect(
      resolveAvailableSkills({
        api,
        agentId: "main",
        bundledSkillsDir: bundled,
        intentBody:
          "skill: agent-orchestration\nskill: analysis\nskill: blogwatcher\nskill: missing",
      }),
    ).toEqual([
      {
        name: "agent-orchestration",
        location: path.join(
          workspace,
          "skills",
          "agent-orchestration",
          "SKILL.md",
        ),
        description: "Workspace orchestration.",
      },
      {
        name: "analysis",
        location: path.join(state, "skills", "analysis", "SKILL.md"),
        description: "Personal analysis.",
      },
      {
        name: "blogwatcher",
        location: path.join(bundled, "blogwatcher", "SKILL.md"),
        description: "Bundled blog watcher.",
      },
    ]);
  });
});
