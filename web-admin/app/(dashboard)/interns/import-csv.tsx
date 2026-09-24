"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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

function parseCsv(text: string): string[][] {
  const lines: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      current.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      current.push(field);
      field = "";
      if (current.some((c) => c.trim() !== "")) lines.push(current);
      current = [];
    } else {
      field += ch;
    }
  }
  current.push(field);
  if (current.some((c) => c.trim() !== "")) lines.push(current);
  return lines;
}

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
  const router = useRouter();

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseCsv(text);
      if (parsed.length < 2) {
        toast.error("File CSV trống hoặc chỉ có dòng tiêu đề.");
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
        return row;
      });
      setRows(mapped);
      setFileName(file.name);
      toast.success(`Đọc được ${mapped.length} dòng từ file.`);
    };
    reader.readAsText(file, "utf-8");
  }

  async function handleImport() {
    if (!rows.length) return;
    setBusy(true);
    const result = await importInternsCsv(rows, {
      batch_id: batchId || null,
      department_id: departmentId || null,
      mentor_id: mentorId || null,
    });
    setBusy(false);

    if (result.error) toast.error(result.error);
    if (result.imported) toast.success(`Đã import ${result.imported} thực tập sinh.`);
    if (result.failed?.length) {
      const sample = result.failed.slice(0, 5).map((f) => `Dòng ${f.index}: ${f.reason}`);
      toast.error(`Có ${result.failed.length} dòng lỗi. ` + sample.join(" · "));
    }

    setOpen(false);
    setRows([]);
    setFileName("");
    router.refresh();
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
              <Label htmlFor="csv">File CSV (.csv / UTF-8)</Label>
              <Input
                id="csv"
                type="file"
                accept=".csv,text/csv,text/plain"
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

            <SheetFooter className="pt-2">
              <Button onClick={handleImport} disabled={busy || !rows.length}>
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