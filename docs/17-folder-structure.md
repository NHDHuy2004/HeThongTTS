# IMS – PHẦN 17: FOLDER STRUCTURE

## 17.1. Web Admin (Next.js)

```text
web-admin/
├── app/
│   ├── (auth)/login/, (auth)/forgot-password/, (auth)/reset-password/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── dashboard/
│   │   ├── interns/, interns/[id]/
│   │   ├── mentors/, mentors/[id]/
│   │   ├── departments/
│   │   ├── internship-batches/
│   │   ├── onboarding/
│   │   ├── tasks/
│   │   ├── attendance/
│   │   ├── requests/
│   │   ├── reports/
│   │   ├── evaluations/
│   │   ├── certificates/
│   │   ├── settings/, users/, audit-logs/
│   ├── api/exports/attendance/route.ts
│   ├── layout.tsx, globals.css, not-found.tsx, error.tsx, loading.tsx
├── components/ui/            # shadcn
├── components/layout/        # sidebar, topbar, breadcrumb, user-menu
├── components/charts/
├── features/
│   ├── dashboard/{components,queries,actions}
│   ├── interns/
│   ├── tasks/{kanban,list,comments,attachments}
│   ├── attendance/
│   ├── requests/
│   ├── reports/
│   ├── evaluations/
│   ├── certificates/
│   └── settings/
├── lib/supabase/{client,server,admin,queries}
├── lib/validators/, lib/utils/, lib/resend/
├── hooks/
├── types/database.ts          # sinh từ supabase gen types
├── styles/
├── public/
├── middleware.ts
├── .env.local, .env.example
└── next.config.mjs, tsconfig.json, tailwind.config.ts
```

## 17.2. Mobile (Flutter)

```text
mobile/
├── lib/
│   ├── main.dart
│   ├── app.dart                # MaterialApp + go_router + theme
│   ├── core/
│   │   ├── config/env.dart     # --dart-define SUPABASE_URL etc.
│   │   ├── constants/          # app_strings (vi), app_colors
│   │   ├── errors/             # AppError{code,message}, failure types
│   │   ├── network/supabase_client.dart, api_exception.dart
│   │   └── utils/              # datetime, geo (haversine client preview),
│   │                           # formatters, result.dart (sealed)
│   ├── features/
│   │   ├── auth/               # data/, domain/, presentation/ (login, forgot, reset)
│   │   ├── dashboard/
│   │   ├── attendance/         # check-in ui + EdgeFunction call
│   │   ├── tasks/
│   │   ├── reports/            # daily, weekly
│   │   ├── requests/           # leave, wfh, late
│   │   ├── notifications/
│   │   ├── profile/
│   │   └── mentor/             # mentor quick actions
│   ├── shared/
│   │   ├── widgets/            # common: loading, empty, error, app_button
│   │   ├── models/             # DTO
│   │   └── repositories/       # generic patterns (interfaces tại features)
│   └── firebase_options.dart
├── test/                       # unit + widget
├── codemagic.yaml
├── pubspec.yaml
└── android/, ios/              # native config (FCM)
```

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
│   └── 0007_realtime.sql
├── functions/
│   ├── shared/{response.ts, auth.ts, supabase.ts, errors.ts, cors.ts}
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