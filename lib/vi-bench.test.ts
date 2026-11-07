// lib/vi-bench.test.ts
// Bench chất lượng + tốc độ Luna (splitText) trên tài liệu tiếng Việt.
// Chạy: npx vitest run lib/vi-bench.test.ts
// Kết quả: bench-output/report.md (dán cho Claude) và bench-output/result.json
// Đọc report trong PowerShell: Get-Content bench-output\report.md -Encoding UTF8
import { describe, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { splitText, type SplitResult, type DraftTask, type SplitOptions } from "./splitter";

const EXPECTED_CHAPTERS = 5; // vi_long.md có 5 chương

const STOP = new Set(
  "và của là những các một có trong cho được với này khi để không như từ đã sẽ cũng thì mà nên hay rất bị ra vào nếu hoặc vì nhưng đó cần mỗi nhiều hơn đến theo bằng sau trước hai ba bốn năm".split(" ")
);
// Từ ghép có trong tài liệu: nếu keyword chỉ là MỘT âm tiết của từ ghép thì nghi tách sai.
const COMPOUNDS = [
  "học máy", "dữ liệu", "trí tuệ", "nhân tạo", "mô hình", "đặc trưng", "huấn luyện",
  "kiểm tra", "quá khớp", "thiếu khớp", "hồi quy", "cây quyết định", "độ chính xác",
  "mạng nơ-ron", "học sâu", "lan truyền", "hạ gradient", "tốc độ", "giá trị", "tập kiểm tra",
  "độ phủ", "điều chuẩn", "kiểm định", "láng giềng", "ma trận", "rừng ngẫu nhiên",
];

// Keyword sai/cụt ĐÃ QUAN SÁT trong các lần chạy trước (cắt dở từ ghép, mảnh âm tiết, bigram xuyên ranh giới từ).
// Đây là danh sách hồi quy để so trước/sau khi vá, KHÔNG phải độ chính xác tổng thể.
const BAD_KEYWORDS = new Set([
  "bị dữ", "dù thuật", "giá mô", "bảng quy", "bước xác", "tập huấn", "mạng nơ",
  "thư", "tự", "hàng", "cây", "mạng", "cân", "dễ", "gì", "hơn", "mươi", "chín",
]);

const CONFIGS: { label: string; opts: SplitOptions }[] = [
  { label: "structured / mỗi chương một module", opts: { structured: true, moduleBy: "chapter" } },
  { label: "structured / mỗi mục một module", opts: { structured: true, moduleBy: "section" } },
  { label: "thường (TextTiling)", opts: {} },
];

const words = (s: string) =>
  s.toLowerCase().split(/[\s,;:.()"'\-–—/?!]+/).filter(Boolean);
const cut = (s: string, n = 200) => (s.length > n ? s.slice(0, n) + "…" : s);
const allTasks = (r: SplitResult): DraftTask[] => r.modules.flatMap((m) => m.tasks);

function sample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor((i * arr.length) / n)]);
  return out;
}

function topKeywords(tasks: DraftTask[], n: number): string[] {
  const freq = new Map<string, number>();
  for (const t of tasks) for (const k of t.keywords ?? []) {
    const key = k.toLowerCase().trim();
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, c]) => `${k}(${c})`);
}

function analyzeConfig(label: string, res: SplitResult, lines: string[]) {
  const tasks = allTasks(res);
  const s = res.stats;
  lines.push(`## Cấu hình: ${label}`);
  lines.push(
    `- Luna báo: ${s.words} từ, ${s.chunks} đoạn, ${s.modules} module, ${s.tasks} task, ${s.totalMinutes} phút, ${Math.round(s.ms)} ms`
  );
  const byType: Record<string, number> = {};
  tasks.forEach((t) => (byType[t.type] = (byType[t.type] ?? 0) + 1));
  lines.push(`- Số task theo loại: ${JSON.stringify(byType)}`);

  lines.push(`- Module:`);
  res.modules.forEach((m, i) => {
    const mins = m.tasks.reduce((x, t) => x + t.estMinutes, 0);
    lines.push(
      `  ${i + 1}. ${m.title}${m.chapter ? ` [chương: ${m.chapter}]` : ""}${m.optional ? " [optional]" : ""} — ${m.tasks.length} task, ${mins} phút`
    );
  });

  if (label.includes("chương")) {
    const core = res.modules.filter((m) => !m.optional).length;
    lines.push(
      `- Kiểm tra số module: kỳ vọng ${EXPECTED_CHAPTERS} chương, thực tế ${core} module không-optional → ${core === EXPECTED_CHAPTERS ? "ĐÚNG" : "LỆCH"}`
    );
  }

  // Keyword / tiêu đề
  const kwAll = tasks.flatMap((t) => t.keywords ?? []);
  const titleTokens = tasks.flatMap((t) => words(t.title));
  const kwTokens = kwAll.flatMap(words);
  const stopKw = kwTokens.filter((w) => STOP.has(w));
  const stopTitle = titleTokens.filter((w) => STOP.has(w));
  lines.push(`- Keyword thường gặp nhất: ${topKeywords(tasks, 30).join(" | ")}`);
  lines.push(
    `- Stopword trong keyword: ${stopKw.length}/${kwTokens.length} token ${stopKw.length ? "→ " + [...new Set(stopKw)].join(", ") : ""}`
  );
  lines.push(
    `- Stopword trong tiêu đề task: ${stopTitle.length}/${titleTokens.length} token (tiêu đề có thể là câu nên stopword là bình thường; chỉ đáng lo nếu tiêu đề toàn stopword)`
  );
  const splitHits: string[] = [];
  const kwSet = new Set(kwAll.map((k) => k.toLowerCase().trim()));
  for (const c of COMPOUNDS) {
    const [a, b] = c.split(" ");
    if (!b) continue;
    if (kwSet.has(a) || kwSet.has(b)) splitHits.push(`"${kwSet.has(a) ? a : b}" đứng riêng (từ ghép "${c}")`);
  }
  const uniqKw = [...new Set(kwAll.map((k) => k.toLowerCase().trim()))];
  const badHits = uniqKw.filter((k) => BAD_KEYWORDS.has(k));
  lines.push(
    `- Keyword thuộc danh sách lỗi đã quan sát: ${badHits.length}/${uniqKw.length} keyword duy nhất ${badHits.length ? "→ " + badHits.join(", ") : ""}`
  );
  lines.push(`- Nghi tách sai từ ghép: ${splitHits.length}`);
  splitHits.slice(0, 12).forEach((x) => lines.push(`  - ${x}`));

  // Tiêu đề task + reason mẫu
  lines.push(`- Tiêu đề task mẫu:`);
  sample(tasks, 12).forEach((t) => lines.push(`  - [${t.type}] ${cut(t.title, 90)} | kw: ${(t.keywords ?? []).join(", ")}`));
  lines.push(`- "reason" mẫu:`);
  sample(tasks, 3).forEach((t) => lines.push(`  - ${cut(t.reason, 160)}`));

  // Chất lượng thẻ
  const cards = tasks.filter((t) => t.type !== "read");
  const withOpts = cards.filter((t) => t.options && t.options.length);
  const badIdx = withOpts.filter((t) => !t.correct || t.correct.some((i) => i < 0 || i >= t.options!.length));
  const dupOpts = withOpts.filter((t) => new Set(t.options!.map((o) => o.toLowerCase().trim())).size !== t.options!.length);
  const stopOpts = withOpts.filter((t) => t.options!.some((o) => STOP.has(o.toLowerCase().trim())));
  const noOptsInChoiceMode = label.startsWith("structured") ? cards.length - withOpts.length : 0;
  lines.push(
    `- Thẻ ôn: ${cards.length} thẻ; có options ${withOpts.length}; chỉ số đáp án hỏng ${badIdx.length}; options trùng ${dupOpts.length}; option là stopword ${stopOpts.length}; thẻ không có options (fallback) ${noOptsInChoiceMode}`
  );
  lines.push(`- Thẻ mẫu (✓ = đáp án đúng):`);
  const flash = sample(cards.filter((t) => t.type === "flashcard"), 3);
  const rec = sample(cards.filter((t) => t.type === "recall"), 3);
  for (const t of [...flash, ...rec]) {
    lines.push(`  • [${t.type}] ${cut(t.body, 220)}`);
    if (t.answer) lines.push(`    đáp án gốc: ${cut(t.answer, 160)}`);
    (t.options ?? []).forEach((o, i) => lines.push(`    ${t.correct?.includes(i) ? "✓" : "·"} ${cut(o, 90)}`));
  }
  lines.push("");
}

describe("Luna trên tiếng Việt", () => {
  it("đo chất lượng + tốc độ", () => {
    // BENCH_FILE: đường dẫn tài liệu thật cần đo (PowerShell: $env:BENCH_FILE="D:\duong\dan\file.md"). Mặc định dùng tài liệu mẫu.
    const text = fs.readFileSync(process.env.BENCH_FILE ?? path.join(__dirname, "__fixtures__", "vi_long.md"), "utf8");
    const outDir = path.join(process.cwd(), "bench-output");
    fs.mkdirSync(outDir, { recursive: true });

    const lines: string[] = [];
    lines.push(`# Báo cáo bench Luna (${new Date().toISOString()})`);
    lines.push(`Tài liệu mẫu: ${words(text).length} từ (tách theo khoảng trắng/dấu câu)\n`);

    const raw: Record<string, SplitResult> = {};
    for (const c of CONFIGS) {
      const res = splitText(text, c.opts);
      raw[c.label] = res;
      analyzeConfig(c.label, res, lines);
    }

    // Kiểm tra giả thuyết: nếu "chương" = heading cấp 1 thì bỏ tiêu đề sách và nâng "Chương N" lên cấp 1 phải ra 5 module.
    {
      const h1 = text.replace(/^# .*\r?\n+/m, "").replace(/^## Chương/gm, "# Chương");
      const label = "structured / mỗi chương một module (chương là heading cấp 1)";
      const res = splitText(h1, { structured: true, moduleBy: "chapter" });
      raw[label] = res;
      analyzeConfig(label, res, lines);
    }

    // Tốc độ: nhân bản nội dung tới ~8000 từ (~30 trang). Chỉ để đo giờ, không dùng đánh giá chất lượng.
    let big = text;
    let n = 1;
    while (words(big).length < 8000) {
      big += "\n\n" + text.replace(/^(#+ .*)$/gm, `$1 (phần ${++n})`);
    }
    lines.push(`## Tốc độ (${words(big).length} từ, mỗi cấu hình 5 lần chạy, đo bằng đồng hồ ngoài)`);
    for (const c of CONFIGS) {
      const wall: number[] = [];
      let lunaMs = 0;
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        const r = splitText(big, c.opts);
        wall.push(performance.now() - t0);
        lunaMs = r.stats.ms;
      }
      wall.sort((x, y) => x - y);
      lines.push(
        `- ${c.label}: min ${wall[0].toFixed(0)} ms | trung vị ${wall[2].toFixed(0)} ms | max ${wall[4].toFixed(0)} ms (stats.ms lần cuối: ${Math.round(lunaMs)} ms; mục tiêu < 1000 ms)`
      );
    }
    lines.push(`- Ghi chú: chạy trên Node/vitest, không phải trình duyệt; số trên trình duyệt có thể khác. Bản nhân lên có nội dung lặp.`);

    fs.writeFileSync(path.join(outDir, "report.md"), lines.join("\n"), "utf8");
    fs.writeFileSync(path.join(outDir, "result.json"), JSON.stringify(raw, null, 2), "utf8");
    console.log(lines.join("\n"));
  });
});
