import 'package:flutter/material.dart';

const statusColors = <String, Color>{
  'present': Colors.green,
  'approved': Colors.green,
  'completed': Colors.green,
  'done': Colors.green,
  'active': Colors.green,
  'submitted': Colors.orange,
  'late': Colors.orange,
  'pending': Colors.orange,
  'in_progress': Colors.blue,
  'rejected': Colors.red,
  'cancelled': Colors.grey,
  'draft': Colors.blueGrey,
  'absent': Colors.red,
};

const statusLabels = <String, String>{
  'present': 'Có mặt',
  'late': 'Đi muộn',
  'absent': 'Vắng',
  'early_leave': 'Về sớm',
  'leave': 'Nghỉ phép',
  'wfh': 'WFH',
  'todo': 'TODO',
  'in_progress': 'Đang làm',
  'review': 'Chờ duyệt',
  'done': 'Hoàn thành',
  'pending': 'Chờ duyệt',
  'approved': 'Đã duyệt',
  'rejected': 'Từ chối',
  'cancelled': 'Đã hủy',
  'submitted': 'Đã gửi',
  'draft': 'Nháp',
  'high': 'Cao',
  'medium': 'TB',
  'low': 'Thấp',
  'urgent': 'Khẩn',
};

class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    return Text(
      (statusLabels[status] ?? status).toUpperCase(),
      style: TextStyle(
        color: statusColors[status] ?? Colors.blueGrey,
        fontSize: 12,
        fontWeight: FontWeight.w600,
      ),
    );
  }
}