// Chuyển thông tin từ trang khởi động (Next Up) sang giao diện tập trung (/study) trong cùng một lần mở tab.
export const STUDY_KEYS = {
  go: "lumo.study.go",
  module: "lumo.study.module",
  task: "lumo.study.task",
} as const;

export function ssGet(k: string): string | null {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
}

export function ssSet(k: string, v: string) {
  try {
    sessionStorage.setItem(k, v);
  } catch {
    /* bỏ qua */
  }
}

export function ssDel(k: string) {
  try {
    sessionStorage.removeItem(k);
  } catch {
    /* bỏ qua */
  }
}