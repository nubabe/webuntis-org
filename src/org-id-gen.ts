import { execFileSync } from "node:child_process";

/**
 * Generates `count` org-id.el-compatible IDs via headless Emacs (`org-id-new`), so ids are
 * exactly what org-id/org-caldav would produce themselves — not a hand-rolled UUID. No user
 * init file is loaded (stock `org-id` defaults only), so this doesn't depend on which of your
 * Emacs configs is active; it only diverges from a customized `org-id-method`.
 */
export const generateOrgIds = (count: number): ReadonlyArray<string> => {
  if (count === 0) return [];

  const elisp = `(progn (require 'org-id) (dotimes (_ ${count}) (princ (org-id-new)) (princ "\\n")))`;
  const output = execFileSync("emacs", ["--batch", "--eval", elisp], { encoding: "utf8" });
  const ids = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (ids.length !== count) {
    throw new Error(`Expected ${count} org-id(s) from Emacs, got ${ids.length}.`);
  }
  return ids;
};
