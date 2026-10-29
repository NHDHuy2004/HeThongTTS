import 'package:flutter/material.dart';

import '../core/theme/app_theme.dart';

/// Bảng màu trạng thái — cùng tông với web-admin (emerald/orange/red...).
const statusColors = <String, Color>{
  'present': AppColors.success,
  'approved': AppColors.success,
  'completed': AppColors.success,
  'done': AppColors.success,
  'active': AppColors.success,
  'in_review': AppColors.warning,
  'submitted': AppColors.warning,
  'late': AppColors.warning,
  'pending': AppColors.warning,
  'needs_revision': AppColors.accent,
  'in_progress': AppColors.info,
  'changes_requested': AppColors.accent,
  'not_started': AppColors.neutral,
  'rejected': AppColors.danger,
  'cancelled': AppColors.neutral,
  'draft': AppColors.neutral,
  'absent': AppColors.danger,
};

const statusLabels = <String, String>{
  'present': 'Có mặt',
  'late': 'Đi muộn',
  'absent': 'Vắng',
  'early_leave': 'Về sớm',
  'leave': 'Nghỉ phép',
  'wfh': 'WFH',
  'not_started': 'Chưa làm',
  'in_progress': 'Đang làm',
  'in_review': 'Chờ duyệt',
  'needs_revision': 'Cần bổ sung',
  'changes_requested': 'Cần sửa',
  'completed': 'Hoàn thành',
  'done': 'Hoàn thành',
  'pending': 'Chờ duyệt',
  'approved': 'Đã duyệt',
  'rejected': 'Từ chối',
  'cancelled': 'Đã hủy',
  'draft': 'Nháp',
  'high': 'Cao',
  'medium': 'TB',
  'low': 'Thấp',
  'urgent': 'Khẩn',
};

/// Pill trạng thái: nền màu 12% + chữ màu đậm — dễ quét mắt trên mọi nền thẻ.
class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final color = statusColors[status] ?? AppColors.neutral;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Text(
        statusLabels[status] ?? status,
        style: TextStyle(
          color: color,
          fontSize: 12,
          height: 1.2,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
