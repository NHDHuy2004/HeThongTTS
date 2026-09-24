# IMS – PHẦN 17: FOLDER STRUCTURE

## 17.1. Web Admin (Next.js)

```text
web-admin/
├── app/
│   ├── (auth)/login/, (auth)/forgot-password/, (auth)/reset-password/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── dashboard/
│   │   ├── interns/, interns/[id]/, interns/import-csv.tsx
│   │   ├── mentors/, mentors/[id]/
│   │   ├── departments/
│   │   ├── internship-batches/
│   │   ├── onboarding/
│   │   ├── tasks/ (page.tsx, task-form.tsx, task-status.tsx, task-actions.ts,
│   │   │         tasks-board.tsx  # kanban + list view)
│   │   ├── attendance/ (page.tsx + export CSV)
│   │   ├── requests/
│   │   ├── reports/ (reports-view.tsx, review-dialog.tsx, report-actions.ts)
│   │   ├── evaluations/
│   │   ├── certificates/
│   │   ├── settings/, users/, audit-logs/
│   ├── api/exports/attendance/route.ts
│   ├── layout.tsx, globals.css, not-found.tsx, error.tsx, loading.tsx
├── components/ui/            # shadcn
├── components/layout/        # sidebar, topbar, breadcrumb, user-menu
├── components/charts/
├── features/                 # labels, formatters, queries
├── lib/supabase/{client,server,admin,guard,queries}
├── lib/validators/, lib/utils/, lib/resend/
├── hooks/
├── types/database.ts          # sinh từ supabase gen types
├── public/logo-dalat.png      # logo ĐH Đà Lạt
├── .env.local, .env.local.example   # (service role key KHÔNG đưa lên client)
└── next.config.mjs, tsconfig.json, tailwind.config.ts
```

## 17.2. Mobile (Flutter)

```text
mobile/
├── lib/
│   ├── main.dart              # khởi tạo + AuthGate (session → role)
│   ├── core/
│   │   └── supabase.dart      # đọc .env + Supabase.initialize
│   ├── features/
│   │   ├── auth/login_screen.dart
│   │   ├── home/home_screen.dart         # shell theo vai trò (bottom nav)
│   │   ├── home/profile_screen.dart
│   │   ├── checkin/checkin_screen.dart   # GPS → Edge Function `check-in`
│   │   └── reports/reports_screen.dart   # gửi/duyệt daily_report
│   └── ...
├── test/                       # unit + widget
├── pubspec.yaml
├── .env.example
└── (android/, ios/ — sinh bằng `flutter create .` sau khi cài SDK)
```

> Trạng thái: hand-written skeleton, chưa compile trên máy này (chưa cài Flutter SDK).
> Chạy `flutter create .` để sinh các file nền tảng trước khi build.

## 17.3. Supabase

```text
supabase/
├── config.toml
├── seed.sql
├── migrations/
│   ├── 0001_enums.sql
│   ├── 0002_tables.sql
│   ├── 0003_indexes.sql
│   ├── 0004_functions_triggers.sql
│   ├── 0005_rls_roles_policies.sql
│   ├── 0006_storage.sql
│   ├── 0007_realtime.sql
│   └── 0009_edge_function_helpers.sql
├── functions/
│   ├── import_map.json          # deno import map
│   ├── _shared/                 # thư viện dùng chung (không deploy thành function)
│   │   ├── supabase.ts, auth.ts, errors.ts, cors.ts
│   │   ├── resend.ts            # email Resend + layout HTML
│   │   ├── fcm.ts               # FCM HTTP v1 (JWT WebCrypto)
│   │   ├── certificate-pdf.ts   # build PDF chứng nhận (font Việt + logo)
│   │   ├── logo.ts              # base64 logo ĐH Đà Lạt
│   ├── check-in/...
│   ├── send-welcome-email/...
│   ├── send-notification/...
│   ├── generate-certificate/...
│   ├── calculate-evaluation/...
│   └── export-attendance/...
├── import_map.json
├── .temp/                      # gitignore
└── deno.json
```

## 17.4. Root

```text
E:\HeThongTTS\
├── web-admin/  mobile/  supabase/  docs/
├── .env.example
├── .gitignore
└── README.md
```