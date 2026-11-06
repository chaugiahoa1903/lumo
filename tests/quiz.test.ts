import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { splitText } from "../lib/splitter";
import { BLANK, REORDER_MAX_WHOLE, REORDER_WINDOW, checkTyped, corpusOf, generateQuestions, type Card } from "../lib/quiz";
import { fold } from "../lib/text";

const demo = (n: string) => readFileSync(join(process.cwd(), "public", "demo", n), "utf8");

// Thẻ từ tài liệu mẫu, kèm đoạn tài liệu (nội dung task đọc đứng trước).
const cards: Card[] = [];
let id = 1;
for (const doc of [demo("sql-co-ban-vi.md"), demo("sql-basics-en.md")]) {
  for (const m of splitText(doc).modules) {
    let ctx = "";
    for (const t of m.tasks) {
      if (t.type === "read") ctx = t.body;
      else if (t.answer) {
        cards.push({ taskId: id++, title: t.title, keywords: t.keywords, answer: t.answer, context: ctx });
      }
    }
  }
}
const corpus = corpusOf(cards);

const UPPER_ONLY = /^[\p{Lu}][\p{Lu}\p{N}_ ]+$/u;

describe("generateQuestions (tài liệu mẫu)", () => {
  it("có thẻ và corpus", () => {
    expect(cards.length).toBeGreaterThan(3);
    expect(corpus.length).toBeGreaterThan(3);
  });

  it("mỗi thẻ một câu, giữ đúng thứ tự", () => {
    const qs = generateQuestions(cards, corpus, 7);
    expect(qs.map((q) => q.taskId)).toEqual(cards.map((c) => c.taskId));
  });

  it("câu hỏi hợp lệ theo từng dạng", () => {
    const qs = generateQuestions(cards, corpus, 7);
    const kinds: Record<string, number> = {};
    for (const q of qs) {
      kinds[q.kind] = (kinds[q.kind] ?? 0) + 1;
      expect(q.full.length).toBeGreaterThan(0);
      if (q.kind === "choice") {
        expect(q.options.length).toBe(4);
        expect(q.options[q.correct]).toBe(q.answerText);
        expect(new Set(q.options.map(fold)).size).toBe(4);
        expect(q.prompt).toContain(BLANK);
        expect(fold(q.prompt)).not.toContain(fold(q.answerText));
        if (q.family === "upper") expect(q.options.every((o) => UPPER_ONLY.test(o))).toBe(true);
      } else if (q.kind === "reorder") {
        expect([...q.words].sort()).toEqual([...q.target].sort());
        expect(q.words.some((w, k) => w !== q.target[k])).toBe(true);
        expect(q.target.length).toBeLessThanOrEqual(REORDER_MAX_WHOLE);
      } else if (q.kind === "type") {
        expect(q.answerText.length).toBeGreaterThan(0);
        expect(q.prompt).toContain(BLANK);
        expect(fold(q.prompt)).not.toContain(fold(q.answerText));
        expect(checkTyped(q.answerText, q.answerText)).toBe(true);
      }
    }
    console.log("quiz kinds:", JSON.stringify(kinds));
    expect(Object.keys(kinds).some((k) => k !== "recall")).toBe(true);
  });

  it("cùng seed cho cùng kết quả", () => {
    expect(generateQuestions(cards, corpus, 3)).toEqual(generateQuestions(cards, corpus, 3));
  });
});

describe("đáp án trắc nghiệm theo họ từ", () => {
  const context =
    "Các hàm tổng hợp gồm COUNT, SUM, AVG, MIN và MAX. Hàm COUNT đếm số hàng trong mỗi nhóm của truy vấn. " +
    "SUM cộng giá trị, AVG tính trung bình, MIN lấy nhỏ nhất, MAX lấy lớn nhất.";
  const countCard: Card = {
    taskId: 1,
    title: "hàm tổng hợp",
    keywords: ["count"],
    answer: "Hàm COUNT đếm số hàng trong mỗi nhóm của truy vấn.",
    context,
  };

  it("hỏi về một hàm thì 4 đáp án đều là hàm", () => {
    const [q] = generateQuestions([countCard], corpusOf([countCard]), 5);
    expect(q.kind).toBe("choice");
    if (q.kind !== "choice") return;
    expect(q.family).toBe("upper");
    expect(q.answerText).toBe("COUNT");
    expect(q.options.length).toBe(4);
    for (const o of q.options) expect(["COUNT", "SUM", "AVG", "MIN", "MAX"]).toContain(o);
    expect(q.options[q.correct]).toBe("COUNT");
  });

  it("không đủ đáp án nhiễu thì không ghép bừa, chuyển sang dạng khác", () => {
    const lone: Card = { ...countCard, context: "Hàm COUNT đếm số hàng trong mỗi nhóm của truy vấn." };
    const [q] = generateQuestions([lone], corpusOf([lone]), 5);
    expect(q.kind).not.toBe("choice");
  });
});

describe("câu xếp lại", () => {
  const longCard: Card = {
    taskId: 2,
    title: "kết hợp bảng",
    keywords: ["join"],
    answer: "Real data is usually spread across several tables so JOIN links them through a shared key every day.",
    context: "",
  };

  it("câu dài chỉ xếp một đoạn, phần còn lại làm ngữ cảnh", () => {
    const firstCard: Card = {
      taskId: 1,
      title: "x",
      keywords: [],
      answer: "",
      context: "",
    };
    const qs = generateQuestions([firstCard, longCard], corpusOf([longCard]), 9);
    const q = qs[1];
    expect(q.kind).toBe("reorder");
    if (q.kind !== "reorder") return;
    expect(q.target.length).toBe(REORDER_WINDOW);
    expect(q.before.length).toBeGreaterThan(0);
    expect(q.after.length).toBeGreaterThan(0);
    expect(q.target).toContain("JOIN");
    expect([...q.words].sort()).toEqual([...q.target].sort());
  });
});

describe("gõ đáp án", () => {
  it("không phân biệt dấu và hoa thường", () => {
    expect(checkTyped("  Dữ Liệu ", "dữ liệu")).toBe(true);
    expect(checkTyped("du lieu", "dữ liệu")).toBe(true);
    expect(checkTyped("", "dữ liệu")).toBe(false);
    expect(checkTyped("nhóm", "dữ liệu")).toBe(false);
  });
});