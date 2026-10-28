"use client";

import * as React from "react";
import { toast } from "sonner";
import { FileUp, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { importInternsCsv, type CsvInternRow } from "./actions";

type Option = { id: string; name: string };

const HEADER_ALIASES: Record<string, keyof CsvInternRow> = {
  student_code: "student_code",
  "ma_sv": "student_code",
  "mã sv": "student_code",
  "masv": "student_code",
  full_name: "full_name",
  "ho_ten": "full_name",
  "họ tên": "full_name",
  "hoten": "full_name",
  email: "email",
  phone: "phone",
  sdt: "phone",
  "sđt": "phone",
  school: "school",
  truong: "school",
  "trường": "school",
  major: "major",
  nganh: "major",
  "ngành": "major",
  class: "class_name",
  class_name: "class_name",
  lop: "class_name",
  "lớp": "class_name",
  gender: "gender",
  "gioi_tinh": "gender",
  "giới tính": "gender",
  birth_date: "birth_date",
  dob: "birth_date",
  "ngay_sinh": "birth_date",
  "ngày sinh": "birth_date",
  address: "address",
  dia_chi: "address",
  "địa chỉ": "address",
  "địa chỉ thường trú": "address",
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

export function ImportCsvForm({
  batches,
  departments,
  mentors,
}: {
  batches: Option[];
  departments: Option[];
  mentors: Option[];
}) {
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<CsvInternRow[]>([]);
  const [fileName, setFileName] = React.useState("");
  const [batchId, setBatchId] = React.useState("");
  const [departmentId, setDepartmentId] = React.useState("");
  const [mentorId, setMentorId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [strict, setStrict] = React.useState(false);
  const [result, setResult] = React.useState<Awaited<ReturnType<typeof importInternsCsv>> | null>(null);

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    const isCsv = /\.(csv|txt)$/i.test(file.name);
    if (!isExcel && !isCsv) {
      toast.error("Chỉ hỗ trợ .xlsx, .xls, .csv");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File vượt quá 10MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      let parsed: string[][] = [];
      try {
        if (isExcel) {
          const XLSX = await import("xlsx");
          const wb = XLSX.read(reader.result, { type: "array", cellDates: true });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<(string | number | Date)[]>(ws, { header: 1, raw: false, dateNF: "yyyy-mm-dd" });
          parsed = json.map((row) => row.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : String(c ?? ""))));
        } else {
          const XLSX = await import("xlsx");
          const text = new TextDecoder("utf-8").decode(reader.result as ArrayBuffer);
          const wb = XLSX.read(text, { type: "string" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<(string | number | Date)[]>(ws, { header: 1, raw: false, dateNF: "yyyy-mm-dd" });
          parsed = json.map((row) => row.map((c) => String(c ?? "")));
        }
      } catch {
        toast.error("Không đọc được file. File có thể bị hỏng hoặc sai định dạng.");
        return;
      }
      parsed = parsed.filter((r) => r.some((c) => c.trim() !== ""));
      if (parsed.length < 2) {
        toast.error("File trống hoặc chỉ có dòng tiêu đề.");
        setRows([]);
        return;
      }
      const header = parsed[0].map(normalizeHeader);
      const allHeaders: string[] = [];
      for (const h of header) {
        if (!allHeaders.includes(h)) allHeaders.push(h);
      }
      const mapping: Record<string, keyof CsvInternRow> = {};
      for (const h of allHeaders) {
        const key =
          HEADER_ALIASES[h] ?? HEADER_ALIASES[h.replace(/[^a-z_]/g, "")];
        if (key) mapping[h] = key;
      }

      const dataLines = parsed.slice(1);
      const mapped: CsvInternRow[] = dataLines.map((line) => {
        const row: CsvInternRow = {
          student_code: "",
          full_name: "",
          email: "",
          phone: "",
          school: "",
          major: "",
          class_name: "",
          gender: "",
          birth_date: "",
          address: "",
        };
        for (let i = 0; i < header.length && i < line.length; i++) {
          const key = mapping[header[i]];
          if (key) row[key] = line[i].trim();
        }
        // Chuẩn hóa giới tính
        const g = row.gender.toLowerCase();
        if (["nam", "male", "m"].includes(g)) row.gender = "male";
        else if (["nữ", "nu", "female", "f"].includes(g)) row.gender = "female";
        else if (["khác", "khac", "other"].includes(g)) row.gender = "other";
        // Chuẩn hóa ngày sinh DD/MM/YYYY → YYYY-MM-DD
        const m = row.birth_date.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (m) row.birth_date = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        return row;
      });
      setRows(mapped);
      setFileName(file.name);
      toast.success(`Đọc được ${mapped.length} dòng từ file.`);
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    if (!rows.length || !batchId) {
      toast.error("Vui lòng chọn đợt thực tập.");
      return;
    }
    setBusy(true);
    const res = await importInternsCsv(
      rows,
      { batch_id: batchId, department_id: departmentId || null, mentor_id: mentorId || null },
      { import_mode: strict ? "strict" : "partial", file_name: fileName },
    );
    setBusy(false);
    setResult(res);

    if (res.error) toast.error(res.error);
    if (res.imported) toast.success(`Đã import ${res.imported} thực tập sinh.`);
  }

  function downloadErrorReport() {
    if (!result?.failed?.length) return;
    const header = "row_number,mssv_or_name,error_code,error_message\n";
    const body = result.failed
      .map((f) => `${f.index},,"${f.code ?? ""}","${f.reason.replace(/"/g, '""')}"`)
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import_errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileUp className="size-4" />
        Import CSV
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Import thực tập sinh từ CSV</SheetTitle>
            <SheetDescription>
              Cột hỗ trợ: mã SV, họ tên, email, SĐT, trường, ngành, lớp, giới tính, ngày sinh, địa chỉ.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="csv">File (.xlsx / .xls / .csv)</Label>
              <Input
                id="csv"
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,text/plain"
                onChange={handleFile}
              />
              {fileName ? (
                <p className="text-xs text-muted-foreground">
                  {fileName} — {rows.length} dòng đã đọc.
                </p>
              ) : null}
            </div>

            {rows.length ? (
              <div className="flex flex-col gap-2">
                <Label>Xem trước (5 dòng đầu)</Label>
                <div className="overflow-hidden rounded-lg border text-xs">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-2 py-1 text-left">Mã SV</th>
                        <th className="px-2 py-1 text-left">Họ tên</th>
                        <th className="px-2 py-1 text-left">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 5).map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-2 py-1">{r.student_code || "—"}</td>
                          <td className="px-2 py-1">{r.full_name || "—"}</td>
                          <td className="px-2 py-1">{r.email || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="import_batch">Gán vào đợt thực tập (tùy chọn)</Label>
              <select
                id="import_batch"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                <option value="">— Chưa chọn —</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="import_department">Phòng ban</Label>
                <select
                  id="import_department"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  <option value="">—</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="import_mentor">Mentor</Label>
                <select
                  id="import_mentor"
                  value={mentorId}
                  onChange={(e) => setMentorId(e.target.value)}
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  <option value="">—</option>
                  {mentors.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} />
              Chế độ nghiêm ngặt: nếu có lỗi thì không import dòng nào
            </label>

            {result ? (
              <div className="rounded-lg border p-3 text-sm">
                <p>Tổng: {rows.length} · Thành công: {result.imported ?? 0} · Lỗi: {result.failed?.length ?? 0}</p>
                {result.failed?.length ? (
                  <Button size="sm" variant="outline" className="mt-2" onClick={downloadErrorReport}>
                    Tải báo cáo lỗi
                  </Button>
                ) : null}
              </div>
            ) : null}

            <SheetFooter className="pt-2">
              <Button onClick={handleImport} disabled={busy || !rows.length || !batchId}>
                <Upload className="size-4" />
                {busy ? "Đang import..." : `Import ${rows.length} dòng`}
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}