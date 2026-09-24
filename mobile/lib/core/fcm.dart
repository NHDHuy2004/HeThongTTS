import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../features/notifications/notifications_screen.dart';
import 'supabase.dart';

const _kApiKey = String.fromEnvironment('FIREBASE_API_KEY');
const _kAppId = String.fromEnvironment('FIREBASE_APP_ID');
const _kSenderId = String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID');
const _kProjectId = String.fromEnvironment('FIREBASE_PROJECT_ID');

/// Extension viết riêng cho client Firebase (không dùng google-services.json).
/// Cấu hình qua `--dart-define` (vd: `flutter run --dart-define=FIREBASE_API_KEY=...`).
/// Nếu thiếu cấu hình → app chạy bình thường, chỉ tắt nhận FCM.
class FcmService {
  FcmService._();

  /// Dùng cho MaterialApp.navigatorKey để push navigation khi tap thông báo.
  static final navigatorKey = GlobalKey<NavigatorState>();

  static bool _available = false;
  static final _localNotif = FlutterLocalNotificationsPlugin();

  static bool get available => _available;

  /// Gọi sau khi khởi tạo Supabase (main). Không block luồng chính.
  static Future<void> init() async {
    if (_kApiKey.isEmpty ||
        _kAppId.isEmpty ||
        _kSenderId.isEmpty ||
        _kProjectId.isEmpty) {
      debugPrint('[FCM] thiếu cấu hình dart-define, tắt push.');
      return;
    }
    try {
      await Firebase.initializeApp(
        options: FirebaseOptions(
          apiKey: _kApiKey,
          appId: _kAppId,
          messagingSenderId: _kSenderId,
          projectId: _kProjectId,
        ),
      );
      _available = true;
    } catch (e) {
      debugPrint('[FCM] Firebase init lỗi: $e');
      return;
    }

    _initLocalNotifications();

    try {
      if (!kIsWeb) {
        FirebaseMessaging.onBackgroundMessage(_backgroundHandler);
      }
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission(alert: true, badge: true, sound: true);

      await registerDevice();

      messaging.onTokenRefresh.listen((token) => _upsertToken(token));
      FirebaseMessaging.onMessage.listen(_onForeground);
      if (!kIsWeb) {
        FirebaseMessaging.onMessageOpenedApp.listen(_onOpened);
        final initial = await messaging.getInitialMessage();
        if (initial != null) _onOpened(initial);
      }
    } catch (e) {
      debugPrint('[FCM] messaging lỗi: $e');
    }
  }

  /// Đăng ký (upsert) token thiết bị cho user đang đăng nhập.
  static Future<void> registerDevice() async {
    if (!_available || kIsWeb) return;
    final user = SupabaseService.instance.auth.currentUser;
    if (user == null) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await _upsertToken(token);
    } catch (e) {
      debugPrint('[FCM] get token lỗi: $e');
    }
  }

  /// Xóa token khi đăng xuất để không còn nhận push trên thiết bị cũ.
  static Future<void> unregisterDevice() async {
    if (!_available || kIsWeb) return;
    final user = SupabaseService.instance.auth.currentUser;
    if (user == null) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await SupabaseService.instance
            .from('notification_devices')
            .delete()
            .match({'user_id': user.id, 'device_token': token});
      }
    } catch (e) {
      debugPrint('[FCM] unregister lỗi: $e');
    }
  }

  static Future<void> _upsertToken(String token) async {
    if (kIsWeb) return;
    final user = SupabaseService.instance.auth.currentUser;
    if (user == null) return;
    final platform = Platform.isIOS ? 'ios' : 'android';
    await SupabaseService.instance.from('notification_devices').upsert({
      'user_id': user.id,
      'device_token': token,
      'platform': platform,
      'last_active_at': DateTime.now().toIso8601String(),
    }, onConflict: 'device_token');
  }

  static void _initLocalNotifications() {
    try {
      const settings = InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      );
      _localNotif.initialize(settings,
          onDidReceiveNotificationResponse: (_) => _openNotifications());
    } catch (e) {
      debugPrint('[FCM] local notif init lỗi: $e');
    }
  }

  static Future<void> _showLocal(String title, String? body) async {
    try {
      const details = NotificationDetails(
        android: AndroidNotificationDetails(
          'interns',
          'Thực tập',
          channelDescription: 'Thông báo hệ thống thực tập',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      );
      await _localNotif.show(
        DateTime.now().millisecondsSinceEpoch.remainder(100000),
        title,
        body ?? '',
        details,
      );
    } catch (e) {
      debugPrint('[FCM] show local lỗi: $e');
    }
  }

  static void _onForeground(RemoteMessage message) {
    final n = message.notification;
    if (n != null) {
      _showLocal(n.title ?? 'Thông báo', n.body);
    }
  }

  static void _onOpened(RemoteMessage message) {
    _openNotifications();
  }

  /// Mở màn danh sách thông báo từ tap push (foreground/background/terminated).
  /// Chỉ mở khi đã đăng nhập và không trùng màn hình đang mở.
  static void _openNotifications() {
    if (SupabaseService.instance.auth.currentUser == null) return;
    final nav = navigatorKey.currentState;
    if (nav == null) return;
    var found = false;
    nav.popUntil((route) {
      found = route.settings.name == NotificationsScreen.routeName;
      return found || route.isFirst;
    });
    if (!found) {
      nav.push(MaterialPageRoute(
        settings: const RouteSettings(name: NotificationsScreen.routeName),
        builder: (_) => const NotificationsScreen(),
      ));
    }
  }
}

@pragma('vm:entry-point')
Future<void> _backgroundHandler(RemoteMessage message) async {
  // Data message khi app ở background/terminated — để mặc định cho OS hiển thị.
  debugPrint('[FCM] background: ${message.notification?.title}');
}