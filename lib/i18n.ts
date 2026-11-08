"use client";

import { useCallback, useSyncExternalStore } from "react";
import { readSettings } from "./settings";

// Đa ngôn ngữ nhẹ cho Lumo: tiếng Việt là bản gốc, tiếng Anh bắt buộc đủ khóa (tsc sẽ báo nếu thiếu).
export type Lang = "vi" | "en";
export const LANGS: { code: Lang; short: string; name: string }[] = [
  { code: "vi", short: "VI", name: "Tiếng Việt" },
  { code: "en", short: "EN", name: "English" },
];

const vi = {
  "settings.title": "Cài đặt",
  "settings.subtitle": "Mọi quy tắc của Lumo đều xem và chỉnh được ở đây.",
  "tab.general": "Chung",
  "tab.learning": "Học tập",
  "tab.data": "Dữ liệu",
  "tab.about": "Giới thiệu",
  "nav.overview": "Tổng quan",
  "nav.library": "Thư viện",
  "nav.plan": "Lộ trình",
  "nav.next": "Next Up",
  "nav.review": "Ôn tập",
  "nav.progress": "Tiến độ",
  "nav.settings": "Cài đặt",
  "nav.main": "Điều hướng chính",
  "nav.search": "Tìm nhanh (Ctrl K)",
  "nav.home": "Lumo, về Tổng quan",
  "nav.between": "Chuyển giữa các phần",
  "nav.first": "Về đầu",
  "nav.firstAria": "Về trang đầu: {name}",
  "general.interface": "Giao diện",
  "lang.title": "Ngôn ngữ",
  "lang.desc": "Đổi ngôn ngữ giao diện. Khóa học đã tạo giữ nguyên ngôn ngữ của tài liệu gốc.",
  "lang.pick": "Chọn ngôn ngữ",
  "motion.title": "Giảm chuyển động",
  "motion.desc": "Tắt hiệu ứng trượt, trồi, chạy đầy và pháo giấy. Lumo cũng tự theo cài đặt giảm chuyển động của hệ điều hành.",
  "learning.session": "Phiên học",
  "session.time": "Thời gian tối đa mỗi phiên",
  "session.tasks": "Số task tối đa mỗi phiên",
  "session.note": "Chạm một trong hai giới hạn, Next Up sẽ hiện màn “Điểm dừng thắng lợi”. Đây là giới hạn mềm: bạn vẫn chọn học thêm được.",
  "learning.celebrate": "Nhịp chúc mừng",
  "celebrate.every": "Chúc mừng sau mỗi",
  "celebrate.note": "Giữa các lần chúc mừng, Lumo tự chuyển sang task kế tiếp để không ngắt nhịp học. Xong một module hoặc chạm mốc thì luôn chúc mừng. Hết hiệp Pomodoro hoặc chạm giới hạn phiên thì vẫn dừng như bình thường.",
  "unit.min": "{n} phút",
  "unit.h": "{h} giờ",
  "unit.hm": "{h} giờ {m} phút",
  "unit.task": "{n} task",
  "data.storage": "Lưu trữ",
  "data.privacy": "Tài liệu, khóa học và tiến độ chỉ nằm trong trình duyệt này. Lumo không có máy chủ, không đăng nhập, không gửi dữ liệu đi đâu. Xóa dữ liệu trình duyệt cũng sẽ làm mất dữ liệu Lumo.",
  "backup.title": "Sao lưu",
  "backup.none": "Bạn chưa sao lưu lần nào. Nên xuất file JSON để không mất dữ liệu.",
  "backup.last": "Sao lưu lần cuối: {date} ({days} ngày trước).",
  "backup.old": "Nên sao lưu lại.",
  "backup.export": "Xuất file sao lưu",
  "backup.import": "Khôi phục từ file",
  "backup.pdfTitle": "Kèm file PDF?",
  "backup.pdfMsg": "Có PDF thì file sao lưu lớn hơn nhiều. Không kèm thì tài liệu PDF sẽ không khôi phục được nội dung.",
  "backup.pdfYes": "Kèm PDF",
  "backup.pdfNo": "Không kèm",
  "backup.withPdf": "kèm PDF",
  "backup.noPdf": "không kèm PDF",
  "backup.exported": "Đã xuất file sao lưu ({mb} MB, {pdf}).",
  "backup.exportFail": "Xuất file thất bại.",
  "backup.restoreTitle": "Khôi phục từ file này?",
  "backup.restoreMsg": "Toàn bộ dữ liệu hiện có trên máy sẽ bị thay bằng nội dung file. Không thể hoàn tác.",
  "backup.restoreYes": "Khôi phục",
  "backup.restored": "Đã khôi phục: {courses} khóa học, {tasks} task, {materials} tài liệu.",
  "backup.restoreFail": "Khôi phục thất bại.",
  "danger.title": "Vùng nguy hiểm",
  "danger.resetTitle": "Đặt lại tiến độ học",
  "danger.resetDesc": "Tài liệu và khóa học vẫn còn. Chỉ xóa kết quả làm task, phiên và nhịp học.",
  "reset.confirmTitle": "Đặt lại tiến độ học?",
  "reset.confirm": "Đặt lại",
  "reset.done": "Đã đặt lại tiến độ học.",
  "danger.wipeTitle": "Xóa toàn bộ dữ liệu",
  "danger.wipeDesc": "Mọi tài liệu, khóa học và tiến độ trên máy này sẽ mất. Không thể hoàn tác.",
  "wipe.confirmTitle": "Xóa toàn bộ dữ liệu?",
  "wipe.label": "Gõ {word} để xác nhận",
  "wipe.word": "XOA",
  "wipe.confirm": "Xóa hết",
  "wipe.done": "Đã xóa toàn bộ dữ liệu trên máy này.",
  "about.title": "Về Lumo",
  "about.text": "Luna, bộ máy chia việc, dùng NLP cổ điển (TF-IDF, TextRank) chạy ngay trong trình duyệt. Luna không phải mô hình ngôn ngữ lớn, không gọi API bên ngoài và không học từ bạn.",
};

export type Key = keyof typeof vi;

const en: Record<Key, string> = {
  "settings.title": "Settings",
  "settings.subtitle": "Every Lumo rule can be viewed and changed here.",
  "tab.general": "General",
  "tab.learning": "Learning",
  "tab.data": "Data",
  "tab.about": "About",
  "nav.overview": "Overview",
  "nav.library": "Library",
  "nav.plan": "Plan",
  "nav.next": "Next Up",
  "nav.review": "Review",
  "nav.progress": "Progress",
  "nav.settings": "Settings",
  "nav.main": "Main navigation",
  "nav.search": "Quick search (Ctrl K)",
  "nav.home": "Lumo, back to Overview",
  "nav.between": "Move between sections",
  "nav.first": "To start",
  "nav.firstAria": "Back to first page: {name}",
  "general.interface": "Interface",
  "lang.title": "Language",
  "lang.desc": "Change the interface language. Courses you already created keep the language of their source material.",
  "lang.pick": "Choose language",
  "motion.title": "Reduce motion",
  "motion.desc": "Turns off sliding, popping, filling and confetti effects. Lumo also follows your operating system's reduce-motion setting.",
  "learning.session": "Study session",
  "session.time": "Maximum time per session",
  "session.tasks": "Maximum tasks per session",
  "session.note": "When you reach either limit, Next Up shows the “Winning stop” screen. It is a soft limit: you can still choose to keep going.",
  "learning.celebrate": "Celebration rhythm",
  "celebrate.every": "Celebrate every",
  "celebrate.note": "Between celebrations, Lumo moves straight to the next task to keep your flow. Finishing a module or hitting a milestone always celebrates. The end of a Pomodoro block or the session limit still stops you as usual.",
  "unit.min": "{n} min",
  "unit.h": "{h} h",
  "unit.hm": "{h} h {m} min",
  "unit.task": "{n} tasks",
  "data.storage": "Storage",
  "data.privacy": "Your materials, courses and progress live only in this browser. Lumo has no server, no sign-in and sends no data anywhere. Clearing your browser data also erases your Lumo data.",
  "backup.title": "Backup",
  "backup.none": "You have never made a backup. Export a JSON file so you don't lose your data.",
  "backup.last": "Last backup: {date} ({days} days ago).",
  "backup.old": "Time to back up again.",
  "backup.export": "Export backup",
  "backup.import": "Restore from file",
  "backup.pdfTitle": "Include PDF files?",
  "backup.pdfMsg": "Including PDFs makes the backup much larger. Without them, PDF materials cannot be restored with their content.",
  "backup.pdfYes": "Include PDFs",
  "backup.pdfNo": "Skip PDFs",
  "backup.withPdf": "with PDFs",
  "backup.noPdf": "without PDFs",
  "backup.exported": "Backup exported ({mb} MB, {pdf}).",
  "backup.exportFail": "Export failed.",
  "backup.restoreTitle": "Restore from this file?",
  "backup.restoreMsg": "All data currently on this device will be replaced by the file's contents. This cannot be undone.",
  "backup.restoreYes": "Restore",
  "backup.restored": "Restored: {courses} courses, {tasks} tasks, {materials} materials.",
  "backup.restoreFail": "Restore failed.",
  "danger.title": "Danger zone",
  "danger.resetTitle": "Reset learning progress",
  "danger.resetDesc": "Materials and courses stay. Only task results, sessions and streaks are cleared.",
  "reset.confirmTitle": "Reset learning progress?",
  "reset.confirm": "Reset",
  "reset.done": "Learning progress has been reset.",
  "danger.wipeTitle": "Erase all data",
  "danger.wipeDesc": "Every material, course and bit of progress on this device will be lost. This cannot be undone.",
  "wipe.confirmTitle": "Erase all data?",
  "wipe.label": "Type {word} to confirm",
  "wipe.word": "DELETE",
  "wipe.confirm": "Erase everything",
  "wipe.done": "All data on this device has been erased.",
  "about.title": "About Lumo",
  "about.text": "Luna, the engine that splits your material into tasks, uses classic NLP (TF-IDF, TextRank) running right in your browser. Luna is not a large language model, calls no external API and does not learn from you.",
};

const DICT: Record<Lang, Record<Key, string>> = { vi, en };

export function translate(l: Lang, key: Key, vars?: Record<string, string | number>): string {
  let s = DICT[l][key] ?? vi[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

const STORE_KEY = "lumo.lang.v1";
let lang: Lang = "vi";
let loaded = false;
let swapping = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const v = localStorage.getItem(STORE_KEY);
    if (v === "vi" || v === "en") lang = v;
  } catch {
    /* dùng mặc định */
  }
}

function setLang(l: Lang) {
  lang = l;
  try {
    localStorage.setItem(STORE_KEY, l);
  } catch {
    /* bỏ qua */
  }
  document.documentElement.lang = l;
  listeners.forEach((f) => f());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): Lang {
  load();
  return lang;
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getSnapshot, () => "vi" as Lang);
}

export function useT() {
  const l = useLang();
  return useCallback((key: Key, vars?: Record<string, string | number>) => translate(l, key, vars), [l]);
}

// Đổi ngôn ngữ: chữ trượt lên rồi mờ đi (260ms), đổi ngôn ngữ, chữ mới trượt vào (380ms).
export function changeLang(next: Lang) {
  load();
  if (next === lang || swapping) return;
  const root = document.documentElement;
  let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  try {
    if (readSettings().reduceMotion) reduced = true;
  } catch {
    /* bỏ qua */
  }
  if (reduced) {
    setLang(next);
    return;
  }
  swapping = true;
  root.classList.remove("lang-in");
  root.classList.add("lang-out");
  window.setTimeout(() => {
    setLang(next);
    root.classList.remove("lang-out");
    root.classList.add("lang-in");
    window.setTimeout(() => {
      root.classList.remove("lang-in");
      swapping = false;
    }, 400);
  }, 260);
}