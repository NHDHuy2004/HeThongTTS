import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import ResetPasswordForm from "./reset-password-form";

function LoadingFallback() {
  return (
    <Card className="w-full">
      <CardContent className="p-6 text-center text-sm text-muted-foreground">
        Đang tải...
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}