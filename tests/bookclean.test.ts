import { describe, expect, it } from "vitest";
import { buildChapters, classifyTitle, readMinutes, stripFurniture, sumChapters, type OutlineEntry } from "../lib/bookclean";

const words = (n: number) => Array.from({ length: n }, () => "w").join(" ");

describe("stripFurniture", () => {
  it("bỏ chân trang bị tách thành 3 dòng", () => {
    const t = "Dòng nội dung một.\nDòng nội dung hai.\n20\n|\nChapter 4: SELECT";
    expect(stripFurniture(t)).toBe("Dòng nội dung một.\nDòng nội dung hai.");
  });

  it("bỏ chân trang nằm trên một dòng, cả hai kiểu, kể cả trang rất ngắn", () => {
    expect(stripFurniture("Nội dung.\n20 | Chapter 4: SELECT")).toBe("Nội dung.");
    expect(stripFurniture("Nội dung.\nChapter 4: SELECT | 21")).toBe("Nội dung.");
  });

  it("bỏ tiêu đề chạy ở đầu trang", () => {
    expect(stripFurniture("Chapter 4: SELECT | 21\n\nNội dung.")).toBe("\nNội dung.");
  });

  it("không đụng vào thân bài và khối code", () => {
    const t = "Chạy lệnh sau:\nSELECT * FROM CUSTOMER;\nKết quả hiển thị ở dưới.";
    expect(stripFurniture(t)).toBe(t);
  });
});

describe("classifyTitle", () => {
  it("phân loại đầu sách, chương, phụ lục, cuối sách", () => {
    expect(classifyTitle("Copyright")).toBe("front");
    expect(classifyTitle("Table of Contents")).toBe("front");
    expect(classifyTitle("Chapter 4. SELECT")).toBe("chapter");
    expect(classifyTitle("Appendix A. Operators and Functions")).toBe("appendix");
    expect(classifyTitle("Index")).toBe("back");
  });
});

describe("buildChapters", () => {
  const pages = Array.from({ length: 8 }, () => words(100));
  const outline: OutlineEntry[] = [
    { title: "Copyright", level: 0, pageIndex: 0 },
    { title: "Chapter 1. Intro", level: 0, pageIndex: 1 },
    { title: "Sec A", level: 1, pageIndex: 1 },
    { title: "Sec B", level: 1, pageIndex: 2 },
    { title: "Chapter 2. Two", level: 0, pageIndex: 3 },
    { title: "  ", level: 1, pageIndex: 3 },
    { title: "Appendix A", level: 0, pageIndex: 5 },
    { title: "Index", level: 0, pageIndex: 7 },
  ];

  it("dựng khoảng trang, từ, phút và loại cho từng mục cấp cao", () => {
    const ch = buildChapters(outline, pages, 100);
    expect(ch.map((c) => [c.title, c.startPage, c.endPage])).toEqual([
      ["Copyright", 0, 0],
      ["Chapter 1. Intro", 1, 2],
      ["Chapter 2. Two", 3, 4],
      ["Appendix A", 5, 6],
      ["Index", 7, 7],
    ]);
    expect(ch[1].words).toBe(200);
    expect(ch[1].minutes).toBe(2);
    expect(ch[1].sections).toBe(2);
    expect(ch[2].sections).toBe(0);
    expect(ch.map((c) => c.kind)).toEqual(["front", "chapter", "chapter", "appendix", "back"]);
    expect(ch.map((c) => c.defaultOn)).toEqual([false, true, true, false, false]);
  });

  it("bỏ mục có trang ngoài phạm vi", () => {
    const ch = buildChapters([...outline, { title: "Ma", level: 0, pageIndex: 99 }], pages, 100);
    expect(ch.length).toBe(5);
  });

  it("không có mục lục thì chia khối 10 trang và đánh dấu đoán", () => {
    const many = Array.from({ length: 25 }, () => words(10));
    const ch = buildChapters([], many, 100);
    expect(ch.map((c) => [c.startPage, c.endPage])).toEqual([[0, 9], [10, 19], [20, 24]]);
    expect(ch.every((c) => c.guessed)).toBe(true);
  });
});

describe("sumChapters", () => {
  it("tổng toàn bộ và chỉ các mục bật mặc định", () => {
    const pages = Array.from({ length: 8 }, () => words(100));
    const ch = buildChapters(
      [
        { title: "Copyright", level: 0, pageIndex: 0 },
        { title: "Chapter 1. A", level: 0, pageIndex: 1 },
        { title: "Chapter 2. B", level: 0, pageIndex: 4 },
        { title: "Index", level: 0, pageIndex: 7 },
      ],
      pages,
      100,
    );
    expect(sumChapters(ch, 100)).toEqual({ chapters: 4, words: 800, minutes: 8 });
    expect(sumChapters(ch, 100, true)).toEqual({ chapters: 2, words: 600, minutes: 6 });
    expect(readMinutes(0)).toBe(0);
  });
});