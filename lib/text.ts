// Bỏ dấu tiếng Việt và chuyển chữ thường, dùng cho tìm kiếm không phân biệt dấu.
export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

// Ngày giờ ngắn, dùng để phân biệt các mục trùng tên.
export function formatStamp(ts: number): string {
  return new Date(ts).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}