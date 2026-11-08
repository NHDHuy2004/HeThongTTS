import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

/**
 * Tạo file Word (.docx) cho phiếu đánh giá thực tập sinh.
 * Dữ liệu được lấy phía server sau khi xác thực + kiểm tra quyền (xem route handler).
 * Lưu ý nghiệp vụ: "Mức độ" là overall_level (mức đánh giá tổng quan suy ra từ
 * final_score), KHÔNG phải tiêu chí được chấm điểm và KHÔNG gộp vào công thức
 * điểm có trọng số. Các tiêu chí chấm điểm lấy từ evaluation_criteria (hiện 6 tiêu chí).
 */

export type DocxEvaluationData = {
  companyName?: string | null;
  evaluation: {
    id: string;
    type: string;
    period_label: string;
    period_start: string | null;
    period_end: string | null;
    due_date: string | null;
    status: string | null;
    final_score: number | string | null;
    overall_level: string | null;
    summary: string | null;
    strengths: string | null;
    needs_improvement: string | null;
    recommendation: string | null;
    submitted_at: string | null;
    reviewed_at: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
  intern: {
    full_name: string | null;
    student_code: string | null;
    email: string | null;
    school: string | null;
    major: string | null;
    class_name: string | null;
    phone: string | null;
  } | null;
  internship: {
    start_date: string | null;
    end_date: string | null;
  } | null;
  departmentName: string | null;
  batchName: string | null;
  mentorName: string | null;
  reviewerName: string | null;
  criteria: Array<{
    id: string;
    name: string;
    category: string;
    description: string | null;
    weight: number | string;
    sort_order: number | null;
  }>;
  scores: Array<{
    criterion_id: string;
    score: number | string | null;
    comment: string | null;
    rating_level: string | null;
  }>;
  evaluationTypeLabel: string;
  exportedAt?: Date;
};

const FONT = "Times New Roman";
type AlignValue = (typeof AlignmentType)[keyof typeof AlignmentType];

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${fmtDate(value)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function levelOf(score: number | null): string {
  if (score === null || Number.isNaN(score)) return "—";
  if (score >= 9) return "Rất tốt";
  if (score >= 8) return "Tốt";
  if (score >= 7) return "Khá";
  if (score >= 5) return "Trung bình";
  return "Chưa đạt";
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function textRun(text: string, opts: { bold?: boolean; size?: number } = {}) {
  return new TextRun({ text, font: FONT, size: opts.size ?? 24, bold: opts.bold ?? false });
}

function para(text: string, opts: { bold?: boolean; size?: number; align?: AlignValue; spacingAfter?: number } = {}) {
  return new Paragraph({
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: { after: opts.spacingAfter ?? 90 },
    children: [textRun(text, { bold: opts.bold, size: opts.size })],
  });
}

function sectionHeading(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 260, after: 120 },
    children: [textRun(text, { bold: true, size: 28 })],
  });
}

const cellBorder = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
};

function headerCell(text: string, width: number) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorder,
    shading: { fill: "D9E2F3" },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [textRun(text, { bold: true, size: 22 })],
      }),
    ],
  });
}

function bodyCell(text: string, opts: { bold?: boolean; align?: AlignValue; width?: number } = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    borders: cellBorder,
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        children: [textRun(text, { bold: opts.bold ?? false, size: 22 })],
      }),
    ],
  });
}

export async function buildEvaluationDocx(data: DocxEvaluationData): Promise<Buffer> {
  const ev = data.evaluation;
  const intern = data.intern;
  const exportedAt = data.exportedAt ?? new Date();
  const companyName = (data.companyName ?? "").trim() || "Đơn vị thực tập";
  const finalScore = toNumber(ev.final_score);
  const overallLevel = ev.overall_level ?? (finalScore !== null ? levelOf(finalScore) : "—");

  const scoreByCriterion = new Map(data.scores.map((s) => [s.criterion_id, s]));
  const sortedCriteria = [...data.criteria].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  // --- Phần I: thông tin chung ---
  const infoRows: Array<[string, string]> = [
    ["Tên công ty / đơn vị thực tập", companyName],
    ["Họ và tên thực tập sinh", intern?.full_name ?? "—"],
    ["MSSV", intern?.student_code ?? "—"],
    ["Email", intern?.email ?? "—"],
    ["Trường học", intern?.school ?? "—"],
    ["Ngành học", intern?.major ?? "—"],
    ["Lớp", intern?.class_name ?? "—"],
    ["Phòng ban", data.departmentName ?? "—"],
    ["Đợt thực tập", data.batchName ?? "—"],
    ["Người hướng dẫn (Mentor)", data.mentorName ?? "—"],
    ["Thời gian thực tập", `${fmtDate(data.internship?.start_date ?? null)} – ${fmtDate(data.internship?.end_date ?? null)}`],
    ["Kỳ đánh giá", `${data.evaluationTypeLabel} — ${ev.period_label}`],
    ["Thời gian kỳ đánh giá", ev.period_start || ev.period_end ? `${fmtDate(ev.period_start)} – ${fmtDate(ev.period_end)}` : "—"],
    ["Người đánh giá", data.reviewerName ?? "—"],
    ["Ngày lập phiếu", fmtDateTime(exportedAt.toISOString())],
    ["Trạng thái phiếu", ev.status ?? "—"],
  ];

  // --- Phần II: bảng tiêu chí ---
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      headerCell("STT", 700),
      headerCell("Tiêu chí", 2600),
      headerCell("Điểm", 900),
      headerCell("Trọng số", 1100),
      headerCell("Mức độ", 1300),
      headerCell("Nhận xét", 3300),
    ],
  });

  const criteriaRows = sortedCriteria.map((c, idx) => {
    const s = scoreByCriterion.get(c.id);
    const score = toNumber(s?.score);
    const weight = toNumber(c.weight);
    const wText = weight !== null ? `${Math.round(weight * 100)}%` : "—";
    const desc = c.description ? `${c.name}. ${c.description}` : c.name;
    return new TableRow({
      children: [
        bodyCell(String(idx + 1), { align: AlignmentType.CENTER, width: 700 }),
        bodyCell(desc, { width: 2600 }),
        bodyCell(score !== null ? `${score.toFixed(1)}` : "Chưa chấm", { align: AlignmentType.CENTER, width: 900 }),
        bodyCell(wText, { align: AlignmentType.CENTER, width: 1100 }),
        bodyCell(s?.rating_level ?? (score !== null ? levelOf(score) : "—"), { align: AlignmentType.CENTER, width: 1300 }),
        bodyCell(s?.comment?.trim() ? s.comment : "—", { width: 3300 }),
      ],
    });
  });

  // Hàng 7: Mức độ tổng quan (overall_level) — KHÔNG chấm điểm riêng, không tính vào điểm có trọng số.
  const levelRowNumber = sortedCriteria.length + 1;
  const levelRow = new TableRow({
    children: [
      bodyCell(String(levelRowNumber), { align: AlignmentType.CENTER, width: 700 }),
      bodyCell("Mức độ (tổng quan)", { bold: true, width: 2600 }),
      bodyCell("—", { align: AlignmentType.CENTER, width: 900 }),
      bodyCell("—", { align: AlignmentType.CENTER, width: 1100 }),
      bodyCell(overallLevel, { bold: true, align: AlignmentType.CENTER, width: 1300 }),
      bodyCell("Mức độ đánh giá tổng quan, không tính vào điểm có trọng số.", { width: 3300 }),
    ],
  });

  // --- Phần III: tổng kết ---
  const summaryPairs: Array<[string, string]> = [
    ["Điểm tổng kết", finalScore !== null ? `${finalScore.toFixed(2)}/10` : "—"],
    ["Xếp loại / Mức độ đánh giá", overallLevel],
    ["Ưu điểm", ev.strengths?.trim() ? ev.strengths : "—"],
    ["Hạn chế / Cần cải thiện", ev.needs_improvement?.trim() ? ev.needs_improvement : "—"],
    ["Nhận xét tổng quan", ev.summary?.trim() ? ev.summary : "—"],
    ["Đề xuất cải thiện", ev.recommendation?.trim() ? ev.recommendation : "—"],
    ["Kết luận của người đánh giá", ev.summary?.trim() ? ev.summary : "—"],
  ];

  // --- Phần IV: xác nhận (không tạo chữ ký / con dấu / phê duyệt giả) ---
  const signRows: Array<[string, string]> = [
    ["Ngày lập phiếu", fmtDate(exportedAt.toISOString())],
    ["Người đánh giá", `${data.reviewerName ?? "—"}\n(Ký và ghi rõ họ tên)`],
    ["Người hướng dẫn", `${data.mentorName ?? "—"}\n(Ký và ghi rõ họ tên)`],
    ["Đại diện bộ phận / đơn vị", "………………………………\n(Ký và ghi rõ họ tên, nếu có)"],
  ];

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4 (twips)
            margin: { top: 1134, bottom: 1134, left: 1417, right: 1417 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [textRun(companyName.toUpperCase(), { bold: true, size: 22 })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                textRun("Phiếu đánh giá thực tập sinh — Hệ thống IMS  ·  Trang ", { size: 20 }),
                new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 }),
                textRun(" / ", { size: 20 }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 20 }),
              ],
            }),
          ],
          }),
        },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [textRun(companyName.toUpperCase(), { bold: true, size: 24 })] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [textRun("PHIẾU ĐÁNH GIÁ THỰC TẬP SINH", { bold: true, size: 34 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 140 },
            children: [
              textRun(`${data.evaluationTypeLabel} — ${ev.period_label}  ·  Ngày lập: ${fmtDate(exportedAt.toISOString())}`, { size: 22 }),
            ],
          }),

          sectionHeading("PHẦN I — THÔNG TIN CHUNG"),
          new Table({
            width: { size: 9900, type: WidthType.DXA },
            rows: infoRows.map(([label, value]) => new TableRow({
              children: [
                bodyCell(label, { bold: true, width: 3400 }),
                bodyCell(value, { width: 6500 }),
              ],
            })),
          }),

          sectionHeading("PHẦN II — NỘI DUNG ĐÁNH GIÁ"),
          para("Thang điểm: 0–10 cho mỗi tiêu chí. Điểm tổng kết được tính có trọng số theo tiêu chí (hệ thống tự tính).", { size: 22 }),
          new Table({
            width: { size: 9900, type: WidthType.DXA },
            rows: [headerRow, ...criteriaRows, levelRow],
          }),

          sectionHeading("PHẦN III — TỔNG KẾT"),
          new Table({
            width: { size: 9900, type: WidthType.DXA },
            rows: summaryPairs.map(([label, value]) => new TableRow({
              children: [
                bodyCell(label, { bold: true, width: 3400 }),
                bodyCell(value, { width: 6500 }),
              ],
            })),
          }),

          sectionHeading("PHẦN IV — XÁC NHẬN"),
          para("Bản phiếu được in từ Hệ thống IMS. Việc xác nhận thực hiện bằng chữ ký tay hoặc ký số theo quy định của đơn vị (tài liệu này không tạo sẵn chữ ký, con dấu hoặc nội dung phê duyệt).", { size: 22 }),
          new Table({
            width: { size: 9900, type: WidthType.DXA },
            rows: signRows.map(([label, value]) => new TableRow({
              children: [
                bodyCell(label, { bold: true, width: 3400 }),
                bodyCell(value, { width: 6500 }),
              ],
            })),
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

/** Chuẩn hóa tên file: Phieu_Danh_Gia_[MSSV]_[HoTen]_[KyDanhGia].docx (ASCII an toàn cho fallback). */
export function buildDocxFilename(mssv: string | null | undefined, fullName: string | null | undefined, periodLabel: string | null | undefined): string {
  const clean = (v: string | null | undefined, fallback: string) => {
    const s = (v ?? "").trim();
    if (!s) return fallback;
    return s
      .replace(/\\/g, "-")
      .replace(/\//g, "-")
      .replace(/\s+/g, "_");
  };
  const m = clean(mssv, "NoMSSV");
  const n = clean(fullName, "Intern");
  const p = clean(periodLabel, "Ky");
  return `Phieu_Danh_Gia_${m}_${n}_${p}.docx`;
}

/** Trả Content-Disposition an toàn cho cả tên có dấu tiếng Việt. */
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  const utf8 = encodeURIComponent(filename).replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
