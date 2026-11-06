/**
 * Helper validate & phân loại file task — dùng chung cho client và server.
 * KHÔNG đặt trong file `"use server"` (hàm sync không được export từ đó).
 */

// Đồng bộ whitelist với DB trigger
const ALLOWED_MIME = [
  /^application\/pdf/,
  /^application\/msword/,
  /^application\/vnd\.openxmlformats-officedocument/,
  /^application\/vnd\.ms-excel/,
  /^application\/vnd\.ms-powerpoint/,
  /^text\/plain/,
  /^image\/(jpeg|png|webp)/,
  /^video\/(mp4|quicktime|webm)/,
];

export function validateTaskFile(file: File): string | null {
  if (!ALLOWED_MIME.some((re) => re.test(file.type))) {
    return "Loại file không được hỗ trợ.";
  }
  const isVideo = file.type.startsWith("video/");
  const max = isVideo ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
  if (file.size > max) {
    return isVideo ? "Video tối đa 500MB." : "File tối đa 50MB.";
  }
  return null;
}

export function fileKindOf(file: File): "document" | "image" | "video" | "other" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("text/") || file.type.includes("pdf") || file.type.includes("word") || file.type.includes("sheet") || file.type.includes("excel") || file.type.includes("powerpoint") || file.type.includes("presentation")) return "document";
  return "other";
}
