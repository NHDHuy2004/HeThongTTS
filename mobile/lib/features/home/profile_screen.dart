import 'package:flutter/material.dart';

import '../../core/supabase.dart';
import '../auth/login_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, required this.role});

  final String role;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  String? _fullName;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final supabase = SupabaseService.instance;
    final user = supabase.auth.currentUser;
    final name = user?.userMetadata?['full_name'];
    if (mounted) {
      setState(() => _fullName = name is String ? name : '—');
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = SupabaseService.instance.auth.currentUser;
    return Scaffold(
      appBar: AppBar(title: const Text('Hồ sơ')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ListTile(
            leading: const CircleAvatar(child: Icon(Icons.person)),
            title: Text(_fullName ?? 'Đang tải...'),
            subtitle: Text(user?.email ?? ''),
          ),
          ListTile(
            leading: const Icon(Icons.badge_outlined),
            title: const Text('Vai trò'),
            trailing: Text(widget.role.toUpperCase()),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.logout),
            title: const Text('Đăng xuất'),
            onTap: () async {
              final navigator = Navigator.of(context);
              await SupabaseService.instance.auth.signOut();
              if (!mounted) return;
              navigator.pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
                (_) => false,
              );
            },
          ),
        ],
      ),
    );
  }
}