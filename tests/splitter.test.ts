import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { splitText, type SplitResult } from "../lib/splitter";

const demo = (name: string) => readFileSync(join(process.cwd(), "public", "demo", name), "utf8");
const viDoc = demo("sql-co-ban-vi.md");
const enDoc = demo("sql-basics-en.md");

function checkInvariants(res: SplitResult) {
  expect(res.modules.length).toBeGreaterThan(0);
  let count = 0;
  for (const m of res.modules) {
    expect(m.title.length).toBeGreaterThan(0);
    expect(m.tasks[0].type).toBe("read");
    expect(m.tasks[m.tasks.length - 1].isMilestone).toBe(true);
    for (const t of m.tasks) {
      expect(t.reason.length).toBeGreaterThan(0);
      expect(t.estMinutes).toBeGreaterThanOrEqual(1);
      expect(t.estMinutes).toBeLessThanOrEqual(5);
      expect(t.difficulty).toBeGreaterThanOrEqual(0);
      expect(t.difficulty).toBeLessThanOrEqual(1);
      count++;
    }
  }
  expect(res.stats.tasks).toBe(count);
}

const readKeywords = (res: SplitResult) =>
  res.modules.flatMap((m) => m.tasks.filter((t) => t.type === "read").flatMap((t) => t.keywords)).join(" | ");

describe("splitText", () => {
  it("tài liệu mẫu tiếng Việt: đủ module/task, có lý do, bắt được từ khóa JOIN", () => {
    const res = splitText(viDoc);
    checkInvariants(res);
    expect(readKeywords(res)).toContain("join");
  });

  it("tài liệu mẫu tiếng Anh: đủ module/task, có lý do, bắt được từ khóa JOIN", () => {
    const res = splitText(enDoc);
    checkInvariants(res);
    expect(readKeywords(res)).toContain("join");
  });

  it("văn bản rỗng không tạo module", () => {
    expect(splitText("").modules).toEqual([]);
    expect(splitText("   \n\n  ").modules).toEqual([]);
  });

  it("kết quả ổn định giữa các lần chạy", () => {
    expect(splitText(viDoc).modules).toEqual(splitText(viDoc).modules);
  });

  it("tách module khi đổi chủ đề (SQL rồi nấu ăn, không có heading ở phần nấu ăn)", () => {
    const cooking =
      "To make a good tomato soup, start by roasting ripe tomatoes with garlic and olive oil until the edges caramelize. " +
      "Transfer them to a heavy pot, add vegetable stock, and let the mixture simmer gently for twenty minutes. " +
      "Stir in fresh basil, a pinch of salt, and a spoonful of cream, then blend until the soup turns smooth. " +
      "Serve it hot with toasted bread, grated cheese, and a few drops of lemon juice. Leftover soup keeps well in the fridge " +
      "and tastes even better the next day, because the flavors of the herbs and tomatoes have time to settle together.";
    const doc = [enDoc, enDoc, enDoc].join("\n\n") + "\n\n" + Array(6).fill(cooking).join("\n\n");
    const res = splitText(doc);
    checkInvariants(res);
    expect(res.modules.length).toBeGreaterThanOrEqual(2);
    for (const m of res.modules) {
      const text = m.tasks.filter((t) => t.type === "read").map((t) => t.body).join(" ");
      expect(text.includes("SELECT") && text.includes("simmer")).toBe(false);
    }
  });

  it("hiệu năng: tài liệu ~30 trang (dữ liệu ghép, chỉ để đo thời gian) chạy dưới 1 giây", () => {
    const big = Array(45).fill([viDoc, enDoc].join("\n\n")).join("\n\n");
    const res = splitText(big);
    console.log(`perf: ${res.stats.words} từ, ${res.stats.chunks} đoạn, ${res.stats.tasks} task, ${res.stats.ms.toFixed(0)} ms`);
    expect(res.stats.ms).toBeLessThan(1000);
  });
});

// Thả thêm tài liệu thật (.md/.txt) vào tests/fixtures để test tự chạy kiểm tra trên đó.
const fixtureDir = join(process.cwd(), "tests", "fixtures");
const fixtures = existsSync(fixtureDir) ? readdirSync(fixtureDir).filter((f) => /\.(md|txt)$/i.test(f)) : [];

describe("fixtures thật", () => {
  if (fixtures.length === 0) {
    it.todo("thêm tài liệu tiếng Việt dài vào tests/fixtures");
  }
  for (const f of fixtures) {
    it(`chia được ${f}`, () => {
      const res = splitText(readFileSync(join(fixtureDir, f), "utf8"));
      checkInvariants(res);
      console.log(`${f}: ${res.stats.words} từ, ${res.stats.modules} module, ${res.stats.tasks} task, ${res.stats.ms.toFixed(0)} ms`);
      for (const m of res.modules) console.log(`  [${m.tasks.length} task] ${m.title} — ${m.reason}`);
    });
  }
});