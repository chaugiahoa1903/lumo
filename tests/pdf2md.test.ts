import { describe, expect, it } from "vitest";
import { convertToMarkdown, type RawItem, type RawPage } from "../lib/pdf2md";

const S = (str: string, y: number, x = 72, h = 10): RawItem => ({ str, family: "serif", h, x, y, w: str.length * 5 });
const M = (str: string, y: number, x = 72, h = 8): RawItem => ({ str, family: "monospace", h, x, y, w: str.length * 4 });
const H = (str: string, y: number, h: number): RawItem => ({ str, family: "sans-serif", h, x: 72, y, w: str.length * h * 0.5 });
const FILL = "Đây là một câu dài làm thân bài để cỡ chữ phổ biến nhất của tài liệu là mười điểm.";
const page = (items: RawItem[]): RawPage => ({ height: 600, items });
const filler = (y0: number, n = 4): RawItem[] => Array.from({ length: n }, (_, i) => S(FILL, y0 - i * 13));

describe("convertToMarkdown", () => {
  it("tiêu đề: gộp nhãn CHAPTER vào tiêu đề cấp 1, cấp 2 cho tiêu đề nhỏ hơn", () => {
    const r = convertToMarkdown([
      page([H("CHAPTER 4", 560, 17), H("SELECT", 530, 25), ...filler(500), H("Retrieving Data", 430, 19), ...filler(400)]),
    ]);
    expect(r.markdown).toContain("# Chapter 4. SELECT");
    expect(r.markdown).toContain("## Retrieving Data");
    expect(r.stats.headings).toBe(2);
  });

  it("nối các dòng thành đoạn, tách đoạn khi khoảng cách dòng lớn, nối từ bị ngắt bằng gạch nối", () => {
    const r = convertToMarkdown([
      page([S("Đây là cách tradi\u2010", 500), S("tional để làm việc này.", 487), S("Đoạn thứ hai bắt đầu ở đây.", 468), ...filler(300)]),
    ]);
    expect(r.markdown).toContain("Đây là cách traditional để làm việc này.\n\nĐoạn thứ hai bắt đầu ở đây.");
  });

  it("code trong câu được bọc backtick", () => {
    const r = convertToMarkdown([
      page([S("Lệnh ", 500), M("SELECT", 500, 100, 9.8), S(" lấy dữ liệu.", 500, 130), ...filler(400)]),
    ]);
    expect(r.markdown).toContain("Lệnh `SELECT` lấy dữ liệu.");
  });

  it("khối code: dòng toàn monospace và nhỏ hơn thân bài, giữ thụt lề", () => {
    const r = convertToMarkdown([
      page([...filler(500), M("SELECT", 420, 89), M("ID,", 410, 101), M("FROM T", 400, 89), ...filler(350)]),
    ]);
    expect(r.markdown).toContain("```\nSELECT\n   ID,\nFROM T\n```");
    expect(r.stats.codeBlocks).toBe(1);
  });

  it("bỏ chân trang ở mép dưới", () => {
    const foot: RawItem = { str: "20 | Chapter 4: SELECT", family: "sans-serif", h: 9, x: 72, y: 30, w: 100 };
    const r = convertToMarkdown([page([...filler(500), foot])]);
    expect(r.markdown).not.toContain("Chapter 4: SELECT");
  });

  it("danh sách gạch đầu dòng", () => {
    const r = convertToMarkdown([page([...filler(500), S("• MySQL", 440, 90), S("• Oracle", 427, 90), ...filler(300)])]);
    expect(r.markdown).toContain("- MySQL\n- Oracle");
  });

  it("nối đoạn bị ngắt qua trang", () => {
    const r = convertToMarkdown([
      page([...filler(500), S("Câu này chưa kết thúc và còn tiếp", 120)]),
      page([S("sang trang sau của tài liệu.", 520), ...filler(480)]),
    ]);
    expect(r.markdown).toContain("Câu này chưa kết thúc và còn tiếp sang trang sau của tài liệu.");
  });

  it("ghi chú chữ nhỏ thành blockquote", () => {
    const r = convertToMarkdown([page([...filler(500), S("Lưu ý nhỏ ở lề.", 430, 137, 9.2), ...filler(300)])]);
    expect(r.markdown).toContain("> Lưu ý nhỏ ở lề.");
  });

  it("trang rỗng không làm hỏng", () => {
    const r = convertToMarkdown([page([])]);
    expect(r.markdown.trim()).toBe("");
  });
});