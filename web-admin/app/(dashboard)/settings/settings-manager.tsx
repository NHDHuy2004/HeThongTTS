"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { updateSetting, type SettingFormState } from "./settings-actions";

export type SettingRow = {
  key: string;
  description: string | null;
  value: unknown;
};

const initialState: SettingFormState = {};

export function SettingsManager({ rows }: { rows: SettingRow[] }) {
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 ? (
        <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
          Chưa có cấu hình nào.
        </p>
      ) : (
        rows.map((row) => (
          <SettingItem key={row.key} row={row} onEdit={setOpenKey} open={openKey === row.key} />
        ))
      )}
    </div>
  );
}

function SettingItem({
  row,
  onEdit,
  open,
}: {
  row: SettingRow;
  onEdit: (key: string | null) => void;
  open: boolean;
}) {
  const [value, setValue] = React.useState(JSON.stringify(row.value, null, 2));
  const [description, setDescription] = React.useState(row.description ?? "");
  const router = useRouter();

  const [state, formAction, pending] = useActionState(
    async (prev: SettingFormState, formData: FormData) => {
      const result = await updateSetting(prev, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Đã lưu cấu hình.");
        onEdit(null);
        router.refresh();
      }
      return result;
    },
    initialState,
  );

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{row.key}</p>
          <p className="text-xs text-muted-foreground">{row.description}</p>
        </div>
        <Button size="xs" variant="outline" onClick={() => onEdit(open ? null : row.key)}>
          <Settings2 className="size-3.5" />
          Sửa
        </Button>
      </div>

      <Sheet open={open} onOpenChange={(o) => onEdit(o ? row.key : null)}>
        <SheetContent className="w-full max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Cấu hình: {row.key}</SheetTitle>
            <SheetDescription>Lưu trữ theo chuỗi JSON.</SheetDescription>
          </SheetHeader>
          <form action={formAction} className="flex flex-col gap-4 py-4">
            <input type="hidden" name="key" value={row.key} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="value">Giá trị (JSON)</Label>
              <Textarea
                id="value"
                name="value"
                rows={8}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Mô tả</Label>
              <Input
                id="description"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {state.error ? (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            ) : null}

            <SheetFooter className="pt-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Đang lưu..." : "Lưu"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}