import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { splitText } from "../lib/splitter";

it("từ khóa tiếng Việt không phải âm tiết lẻ khi có cụm hai từ", () => {
  const res = splitText(readFileSync(join(process.cwd(), "public", "demo", "sql-co-ban-vi.md"), "utf8"));
  const kws = res.modules.flatMap((m) => m.tasks.flatMap((t) => t.keywords));
  console.log("keywords vi:", [...new Set(kws)].join(" | "));
  for (const bad of ["liệu", "sắp", "xếp", "giới"]) expect(kws).not.toContain(bad);
});