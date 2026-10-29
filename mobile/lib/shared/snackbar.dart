import 'package:flutter/material.dart';

/// Thông báo lỗi cho người dùng bằng thông báo thân thiện.
/// Chi tiết kỹ thuật chỉ in ra console (debugPrint) — không hiển thị lên UI.
SnackBar friendlyErrorSnack(
  Object error, {
  String message = 'Thao tác thất bại. Vui lòng thử lại.',
}) {
  debugPrint('Action failed: $error');
  return SnackBar(content: Text(message));
}
