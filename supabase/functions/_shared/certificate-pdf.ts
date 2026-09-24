import { PDFDocument, PDFFont } from "pdf-lib";
import fontkit from "fontkit";
import { LOGO_BASE64, LOGO_MIME } from "./logo.ts";

let cachedFont: PDFFont | null = null;

const FONT_CANDIDATES = [
  // Ưu tiên TTF do người vận hành tự host (tải lên storage, điền env CERT_FONT_URL)
  Deno.env.get("CERT_FONT_URL"),
  // Dự phòng: font Be Vietnam Pro (web font chính của dự án)
  "https://cdn.jsdelivr.net/gh/BeVietnam/be-vietnam-pro-ttf@main/ttf/BeVietnamPro-Regular.ttf",
  "https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro[slnt,wght].ttf",
];

export type CertificateData = {
  companyName: string;
  title: string;
  fullName: string;
  position: string;
  departmentName: string;
  batchName: string;
  startDate: string;
  endDate: string;
  certificateCode: string;
  signerName: string;
  signerTitle: string;
};

async function loadFont(doc: PDFDocument): Promise<PDFFont | null> {
  if (cachedFont) return cachedFont;
  doc.registerFontkit(fontkit);

  for (const url of FONT_CANDIDATES) {
    if (!url) continue;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const buffer = new Uint8Array(await res.arrayBuffer());
      const font = await doc.embedFont(buffer, { subset: true });
      cachedFont = font;
      console.log("[certificate] font loaded:", url);
      return font;
    } catch (e) {
      console.error("[certificate] font load failed:", url, String(e));
    }
  }
  return null;
}

export async function buildCertificatePdf(data: CertificateData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([841.89, 595.28]); // A4 landscape
  const { width, height } = page.getSize();

  // Font: ưu tiên font Việt hóa, fallback chuẩn (mất dấu nếu không tải được)
  const font = await loadFont(doc);

  // ---- Khung viền ----
  page.drawRectangle({
    x: 40, y: 40,
    width: width - 80, height: height - 80,
    borderColor: { r: 0.12, g: 0.23, b: 0.37 },
    borderWidth: 2,
  });
  page.drawRectangle({
    x: 48, y: 48,
    width: width - 96, height: height - 96,
    borderColor: { r: 0.75, g: 0.78, b: 0.82 },
    borderWidth: 0.5,
  });

  // ---- Logo trường ----
  try {
    const logo = await doc.embedPng(new Uint8Array(atobToBytes(LOGO_BASE64)));
    const logoSize = 110;
    page.drawImage(logo, {
      x: (width - logoSize) / 2,
      y: height - 190,
      width: logoSize,
      height: logoSize,
    });
  } catch {
    console.error("[certificate] logo embed failed");
  }

  const cx = width / 2;
  const textSize = (s: string, size: number) =>
    page.drawText(s, { x: (width - (font?.widthOfTextAtSize(s, size) ?? 0)) / 2, size, font: font ?? undefined, color: { r: 0.1, g: 0.12, b: 0.14 } });

  let y = height - 220;

  // ---- Công ty + tiêu đề ----
  textSize(data.companyName || "CÔNG TY TNHH ABC", 16);
  y -= 40;
  textSize("CHỨNG NHẬN HOÀN THÀNH THỰC TẬP", 24);
  y -= 20;
  textSize("CERTIFICATE OF INTERNSHIP COMPLETION", 10);
  y -= 46;

  // ---- Nội dung ----
  textSize(`Xác nhận intern: ${data.fullName}`, 15);
  y -= 28;
  textSize(`Vị trí: ${data.position} · Phòng ban: ${data.departmentName}`, 13);
  y -= 22;
  textSize(`Đợt thực tập: ${data.batchName}`, 13);
  y -= 22;
  textSize(`Thời gian: ${data.startDate} → ${data.endDate}`, 13);
  y -= 36;

  // Mã chứng nhận trong khung
  page.drawRectangle({
    x: cx - 130, y: y - 8,
    width: 260, height: 30,
    borderColor: { r: 0.55, g: 0.58, b: 0.62 },
    borderWidth: 0.6,
  });
  textSize(`Mã chứng nhận: ${data.certificateCode}`, 12);
  y -= 74;

  // ---- Người ký ----
  textSize(data.signerName || "", 13);
  y -= 6;
  textSize(data.signerTitle || "", 11);
  y -= 20;
  textSize("(Ký, ghi rõ họ tên)", 9);

  doc.setTitle(`Chứng nhận thực tập - ${data.fullName}`);
  return doc.save();
}

function atobToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}