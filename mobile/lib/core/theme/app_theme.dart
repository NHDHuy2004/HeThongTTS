import 'package:flutter/material.dart';

/// Design tokens — đồng bộ palette với web-admin (emerald + orange).
abstract final class AppColors {
  /// Emerald-600 — seed color của app (khớp web).
  static const seed = Color(0xFF059669);

  /// Orange-600 — màu nhấn phụ (cảnh báo, deadline).
  static const accent = Color(0xFFEA580C);

  static const background = Color(0xFFF4F7F6);
  static const border = Color(0xFFE3E9E7);

  static const success = Color(0xFF16A34A);
  static const warning = Color(0xFFEA580C);
  static const danger = Color(0xFFDC2626);
  static const info = Color(0xFF2563EB);
  static const neutral = Color(0xFF64748B);
}

/// Khoảng cách bội số 4/8 — tránh giá trị lẻ lung tung.
abstract final class AppSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
}

/// Bán kính bo góc thống nhất.
abstract final class AppRadius {
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 14;
  static const double pill = 999;
}

ThemeData buildAppTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: AppColors.seed);
  return ThemeData(
    colorScheme: scheme,
    useMaterial3: true,
    scaffoldBackgroundColor: AppColors.background,
    appBarTheme: AppBarTheme(
      backgroundColor: scheme.surface,
      elevation: 0,
      scrolledUnderElevation: 0.5,
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      margin: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(AppRadius.lg)),
        side: BorderSide(color: AppColors.border),
      ),
    ),
    inputDecorationTheme: const InputDecorationTheme(
      border: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(AppRadius.md)),
      ),
      contentPadding:
          EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.md),
    ),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      ),
    ),
  );
}
