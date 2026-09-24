import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'supabase.dart';

/// Wire Realtime (Postgres CDC) cho mobile:
/// - `notifications`: có thông báo mới cho user đang đăng nhập (RLS tự lọc).
/// - `reviewChanges`: mới insert vào các bảng đơn/báo cáo → làm mới dashboard.
class RealtimeService {
  RealtimeService._();

  static final instance = RealtimeService._();

  final List<RealtimeChannel> _channels = [];
  final _notifCtrl = StreamController<Map<String, dynamic>>.broadcast();
  final _reviewCtrl = StreamController<void>.broadcast();

  Stream<Map<String, dynamic>> get notifications => _notifCtrl.stream;
  Stream<void> get reviewChanges => _reviewCtrl.stream;

  /// Idempotent: dừng kênh cũ rồi subscribe lại theo user hiện tại.
  Future<void> start() async {
    await stop();
    final supabase = SupabaseService.instance;
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;

    try {
      final notifChannel = supabase
          .channel('rt:notifications:$uid')
          .onPostgresChanges(
            event: PostgresChangeEvent.insert,
            schema: 'public',
            table: 'notifications',
            filter: PostgresChangeFilter(
              type: PostgresChangeFilterType.eq,
              column: 'user_id',
              value: uid,
            ),
            callback: (payload) => _notifCtrl.add(payload.newRecord),
          );
      notifChannel.subscribe();
      _channels.add(notifChannel);

      final reviewChannel = supabase.channel('rt:reviews:$uid');
      for (final table in const [
        'leave_requests',
        'work_from_home_requests',
        'late_requests',
        'daily_reports',
      ]) {
        reviewChannel.onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: table,
          callback: (_) => _reviewCtrl.add(null),
        );
      }
      reviewChannel.subscribe();
      _channels.add(reviewChannel);
    } catch (e) {
      await stop();
      debugPrint('[Realtime] subscribe lỗi: $e');
    }
  }

  Future<void> stop() async {
    final supabase = SupabaseService.instance;
    for (final channel in _channels) {
      try {
        await supabase.removeChannel(channel);
      } catch (_) {}
    }
    _channels.clear();
  }
}