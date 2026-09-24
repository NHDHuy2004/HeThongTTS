import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Khởi tạo Supabase + đọc env từ mobile/.env.
class SupabaseService {
  SupabaseService._();

  static Future<void> initialize() async {
    await dotenv.load();
    final url = dotenv.env['SUPABASE_URL'];
    final anonKey = dotenv.env['SUPABASE_ANON_KEY'];
    if (url == null || url.isEmpty || anonKey == null || anonKey.isEmpty) {
      throw StateError('Thiếu SUPABASE_URL / SUPABASE_ANON_KEY trong mobile/.env');
    }
    await Supabase.initialize(url: url, anonKey: anonKey);
  }

  static SupabaseClient get instance => Supabase.instance.client;
}