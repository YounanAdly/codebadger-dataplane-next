/** Rules supplied by the repository being reviewed, at the reviewed revision. */
export interface ProjectRuleFile {
  path: string;
  content: string;
}

export const PROJECT_RULES_DIR = ".ai-review";
export const MAX_PROJECT_RULE_FILES = 20;
export const MAX_PROJECT_RULE_FILE_BYTES = 32_000;

/** Only Markdown or text files inside the project rules folder are review rules. */
export function isProjectRulePath(path: string): boolean {
  return path.startsWith(`${PROJECT_RULES_DIR}/`) &&
    !path.split("/").some((part) => part === "." || part === ".." || !part) &&
    /\.(md|txt)$/i.test(path);
}
