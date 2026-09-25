import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { OnboardingConfigurationManager } from "@/features/onboarding/configuration-manager";
import { loadOnboardingConfiguration } from "@/features/onboarding/data";
import type { OnboardingTemplateView } from "@/features/onboarding/types";

export default async function OnboardingTemplatesPage() {
  const session = await requireAuth();
  if (session.profile?.role_code !== "admin") redirect("/dashboard");
  const configuration = await loadOnboardingConfiguration();
  const templates: OnboardingTemplateView[] = configuration.templates.map((template) => ({
    ...template,
    items: configuration.items.filter((item) => item.template_id === template.id),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cấu hình onboarding"
        description="Quản lý mẫu checklist và loại tài liệu dùng chung."
        actions={<Button variant="outline" render={<Link href="/admin/onboarding" />}><ArrowLeft />Về danh sách</Button>}
      />
      <OnboardingConfigurationManager
        templates={templates}
        documentTypes={configuration.documentTypes.map((item) => ({ id: item.code, code: item.code, name: item.name }))}
        documents={configuration.documents.map((item) => ({ id: item.id, name: item.title }))}
        catalogDocuments={configuration.documents.map((item) => ({
          id: item.id,
          name: item.title,
          document_type: item.document_type,
          file_path: item.file_path,
          file_url: item.file_url,
        }))}
      />
    </div>
  );
}
