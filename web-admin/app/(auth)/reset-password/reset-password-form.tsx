"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createClient } from "@/lib/supabase/client";

type Step = "exchanging" | "ready" | "error";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("exchanging");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const code = searchParams.get("code");

    if (!code) {
      queueMicrotask(() => {
        setStep("error");
        setError("Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");
      });
      return;
    }

    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error: exchangeErr }) => {
        if (exchangeErr) {
          setStep("error");
          setError("Không thể xác thực link. Vui lòng yêu cầu link mới.");
          return;
        }
        setStep("ready");
      })
      .catch(() => {
        setStep("error");
        setError("Đã xảy ra lỗi xác thực link.");
      });
  }, [searchParams]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const password = String(new FormData(form).get("password") ?? "");
    const confirm = String(new FormData(form).get("confirm") ?? "");

    if (password.length < 8) {
      setError("Mật khẩu tối thiểu 8 ký tự.");
      return;
    }
    if (password !== confirm) {
      setError("Xác nhận mật khẩu không khớp.");
      return;
    }

    setPending(true);
    setError("");

    const supabase = createClient();
    const { error: updateErr } = await supabase.auth.updateUser({ password });

    if (updateErr) {
      setError(updateErr.message);
      setPending(false);
      return;
    }

    await supabase.auth.signOut();
    router.push("/login?reset=1");
  }

  if (step === "exchanging") {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Đang xác thực link...
        </CardContent>
      </Card>
    );
  }

  if (step === "error") {
    return (
      <Card className="w-full">
        <CardContent className="flex flex-col gap-4 p-6">
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
          <Link
            href="/forgot-password"
            className="text-center text-sm text-primary underline-offset-4 hover:underline"
          >
            Gửi lại link đặt lại mật khẩu
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Đặt lại mật khẩu</CardTitle>
        <CardDescription>Nhập mật khẩu mới cho tài khoản của bạn.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Mật khẩu mới</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm">Xác nhận mật khẩu</Label>
            <Input id="confirm" name="confirm" type="password" required />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
        <CardContent className="pt-0">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Đang lưu..." : "Đặt lại mật khẩu"}
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}