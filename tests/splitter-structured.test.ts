import { describe, expect, it } from "vitest";
import { splitText } from "../lib/splitter";

const para = (topic: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${topic} câu số ${i + 1} nói về ${topic} và cách dùng ${topic} trong thực tế.`).join(" ");

const DOC = [
  "# Chapter 1. Cơ bản",
  "Giới thiệu ngắn.",
  "## Biến",
  para("biến", 30),
  "## Hàm",
  para("hàm", 30),
  "## Summary",
  "Tóm tắt rất ngắn.",
  "# Appendix A. Tham khảo",
  "## Appendix A1 – Bảng",
  para("bảng", 30),
].join("\n\n");

describe("splitText structured", () => {
  const r = splitText(DOC, { structured: true, wordsPerMinute: 150 });

  it("module bám theo tiêu đề mục, kèm chương", () => {
    const titles = r.modules.map((m) => m.title);
    expect(titles[0]).toBe("Biến");
    expect(titles).toContain("Hàm");
    expect(r.modules[0].chapter).toBe("Chapter 1. Cơ bản");
  });

  it("mục quá nhỏ (Summary) được gộp vào mục trước, không tự thành module", () => {
    expect(r.modules.map((m) => m.title)).not.toContain("Summary");
  });

  it("phụ lục được đánh dấu optional, chương thường thì không", () => {
    const app = r.modules.filter((m) => m.optional);
    expect(app.length).toBeGreaterThan(0);
    expect(app.every((m) => /^Appendix/i.test(m.chapter ?? ""))).toBe(true);
    expect(r.modules[0].optional).toBe(false);
  });

  it("module nào cũng kết thúc bằng milestone và có task ôn cuối", () => {
    for (const m of r.modules) {
      const last = m.tasks[m.tasks.length - 1];
      expect(last.isMilestone).toBe(true);
      expect(last.type).not.toBe("read");
    }
  });

  it("mục dài bị cắt thành (phần k/n)", () => {
    const long = splitText(["# C", "## Dài", para("dài", 400)].join("\n\n"), { structured: true });
    expect(long.modules.length).toBeGreaterThan(1);
    expect(long.modules[0].title).toMatch(/\(phần 1\/\d+\)$/);
  });

  it("tên task đọc không trùng nhau trong một mục nhiều đoạn", () => {
    const long = splitText(["# C", "## Dài", para("dài", 400)].join("\n\n"), { structured: true });
    const reads = long.modules.flatMap((m) => m.tasks.filter((t) => t.type === "read").map((t) => t.title));
    expect(new Set(reads).size).toBe(reads.length);
  });

  it("ít task ôn hơn chế độ thường với cùng văn bản", () => {
    const plain = splitText(DOC, { wordsPerMinute: 150 });
    const count = (x: typeof r) => x.modules.flatMap((m) => m.tasks).filter((t) => t.type !== "read").length;
    expect(count(r)).toBeLessThan(count(plain));
  });

  it("chế độ thường không thêm chapter/optional", () => {
    const plain = splitText(DOC);
    expect(plain.modules.every((m) => m.chapter === undefined && m.optional === undefined)).toBe(true);
  });
});

describe("splitText structured moduleBy chapter", () => {
  const r = splitText(DOC, { structured: true, moduleBy: "chapter", wordsPerMinute: 150 });
  it("mỗi chương đúng một module", () => {
    expect(r.modules.map((m) => m.title)).toEqual(["Chapter 1. Cơ bản", "Appendix A. Tham khảo"]);
  });
  it("phụ lục optional, chương thường thì không", () => {
    expect(r.modules.map((m) => m.optional)).toEqual([false, true]);
  });
  it("task đọc vẫn mang tên mục con", () => {
    const reads = r.modules[0].tasks.filter((t) => t.type === "read").map((t) => t.title).join("|");
    expect(reads).toContain("Biến");
    expect(reads).toContain("Hàm");
  });
});

describe("flashcard (structured)", () => {
  const r = splitText(DOC, { structured: true, wordsPerMinute: 150 });
  const flash = r.modules.flatMap((m) => m.tasks).filter((t) => t.type === "flashcard");
  it("mỗi flashcard là thẻ chọn từ diễn giải hoặc thẻ điền chỗ trống", () => {
    expect(flash.length).toBeGreaterThan(0);
    for (const t of flash) expect(t.body.startsWith("Chọn ") || t.body.includes("_____")).toBe(true);
  });
  it("thẻ chọn từ: số đáp án đúng 1..3 và đủ 3 từ gây nhiễu", () => {
    for (const t of flash.filter((x) => x.body.startsWith("Chọn "))) {
      expect(t.correct!.length).toBeGreaterThanOrEqual(1);
      expect(t.correct!.length).toBeLessThanOrEqual(3);
      expect(t.options!.length).toBe(t.correct!.length + 3);
      expect(t.body).toContain(String(t.correct!.length));
    }
  });
  it("đáp án không lộ ở đề và không có dấu > của ghi chú", () => {
    for (const t of flash) expect((t.answer ?? "").includes("Câu gốc: >")).toBe(false);
  });
});

describe("thẻ ôn gọn (structured)", () => {
  const long = Array.from({ length: 40 }, (_, i) => `từ${i}`).join(" ");
  const doc = ["# C", "## Mục", `Khái niệm quan trọng ${long} cuối cùng là biến. `.repeat(12)].join("\n\n");
  const r = splitText(doc, { structured: true, reviewEvery: 1 });
  const rev = r.modules.flatMap((m) => m.tasks).filter((t) => t.type !== "read");
  it("đề điền chỗ trống chỉ còn đoạn ngắn quanh chỗ trống", () => {
    const fl = rev.filter((t) => t.body.includes("_____"));
    for (const t of fl) expect(t.body.split(/\s+/).length).toBeLessThanOrEqual(22);
  });
  it("thẻ nhớ lại hỏi từ khóa và đáp án có dòng Từ khóa", () => {
    const rc = rev.filter((t) => t.type === "recall");
    expect(rc.length).toBeGreaterThan(0);
    for (const t of rc) {
      expect(t.body).toContain("từ khóa");
      expect(t.answer).toContain("Từ khóa:");
      expect((t.answer ?? "").split("Ý chính: ")[1].split(/\s+/).length).toBeLessThanOrEqual(22);
    }
  });
});

describe("thẻ trắc nghiệm (structured)", () => {
  const topics = ["biến", "hàm", "mảng", "lớp", "chuỗi", "tệp"];
  const body = (tp: string) =>
    Array.from({ length: 14 }, (_, i) => `Trong phần ${tp} câu ${i + 1} cho thấy ${tp} quan trọng với ${tp} ${tp}${i} thế nào.`).join(" ");
  const doc = ["# C", ...topics.flatMap((tp) => [`## ${tp}`, body(tp)])].join("\n\n");
  const r = splitText(doc, { structured: true, reviewEvery: 1 });
  const rev = r.modules.flatMap((m) => m.tasks).filter((t) => t.type !== "read");
  const withOpt = rev.filter((t) => t.options);

  it("có thẻ trắc nghiệm, đáp án đúng nằm trong các lựa chọn và không trùng nhau", () => {
    expect(withOpt.length).toBeGreaterThan(0);
    for (const t of withOpt) {
      expect(new Set(t.options).size).toBe(t.options!.length);
      expect((t.correct ?? []).length).toBeGreaterThan(0);
      for (const c of t.correct!) expect(c).toBeLessThan(t.options!.length);
    }
  });
  it("flashcard: đủ 3 từ gây nhiễu; nhớ lại: nhiều đáp án đúng", () => {
    for (const t of withOpt.filter((x) => x.type === "flashcard")) expect(t.options!.length).toBe(t.correct!.length + 3);
    for (const t of withOpt.filter((x) => x.type === "recall")) expect(t.correct!.length).toBeGreaterThan(1);
  });
  it("kết quả ổn định giữa các lần chạy", () => {
    const again = splitText(doc, { structured: true, reviewEvery: 1 });
    expect(again.modules.flatMap((m) => m.tasks).map((t) => t.options)).toEqual(r.modules.flatMap((m) => m.tasks).map((t) => t.options));
  });
  it("chế độ thường không có options", () => {
    const plain = splitText(doc);
    expect(plain.modules.flatMap((m) => m.tasks).every((t) => t.options === undefined)).toBe(true);
  });
});

describe("choiceCards ngoài chế độ structured", () => {
  const doc = ["# C", ...["biến", "hàm", "mảng", "lớp", "chuỗi", "tệp"].flatMap((tp) => [`## ${tp}`, Array.from({ length: 14 }, (_, i) => `Trong phần ${tp} câu ${i + 1} cho thấy ${tp} quan trọng với ${tp} ${tp}${i} thế nào.`).join(" ")])].join("\n\n");
  it("bật choiceCards thì thẻ ôn có options, tắt thì không", () => {
    const on = splitText(doc, { choiceCards: true }).modules.flatMap((m) => m.tasks).filter((t) => t.type !== "read");
    const off = splitText(doc).modules.flatMap((m) => m.tasks).filter((t) => t.type !== "read");
    expect(on.some((t) => t.options)).toBe(true);
    expect(off.every((t) => t.options === undefined)).toBe(true);
  });
});
