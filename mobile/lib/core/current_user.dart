import 'supabase.dart';

/// ID hồ sơ intern của user đang đăng nhập (theo user_id), nếu có.
Future<String?> myInternId() async {
  final uid = SupabaseService.instance.auth.currentUser?.id;
  if (uid == null) return null;
  final intern = await SupabaseService.instance
      .from('interns')
      .select('id')
      .eq('user_id', uid)
      .maybeSingle();
  return intern?['id'] as String?;
}

/// Danh sách internship của intern hiện tại (qua RPC, RLS tự lọc).
Future<List<String>> myInternshipIds() async {
  final res = await SupabaseService.instance
      .rpc<List<dynamic>>('get_my_internship_ids');
  return res.whereType<String>().toList();
}

/// Vai trò hiện tại (luôn đọc từ DB, không tin client).
Future<String> myRole() async {
  return SupabaseService.instance.rpc<String>('get_my_role');
}