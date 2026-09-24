import 'package:flutter/material.dart';

import 'core/supabase.dart';
import 'features/auth/login_screen.dart';
import 'features/home/home_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SupabaseService.initialize();
  runApp(const HeThongTtsApp());
}

class HeThongTtsApp extends StatelessWidget {
  const HeThongTtsApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Hệ thống Thực tập',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.indigo),
        useMaterial3: true,
      ),
      home: const AuthGate(),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final supabase = SupabaseService.instance;
    final session = supabase.auth.currentSession;
    if (session == null) {
      return const LoginScreen();
    }
    final expiresAt = session.expiresAt;
    if (expiresAt != null &&
        DateTime.fromMillisecondsSinceEpoch(expiresAt * 1000)
            .isBefore(DateTime.now())) {
      return const LoginScreen();
    }
    return const HomeRedirect();
  }
}

class HomeRedirect extends StatefulWidget {
  const HomeRedirect({super.key});

  @override
  State<HomeRedirect> createState() => _HomeRedirectState();
}

class _HomeRedirectState extends State<HomeRedirect> {
  String? _role;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final role = await SupabaseService.instance.rpc<String>('get_my_role');
      if (mounted) setState(() => _role = role);
    } catch (_) {
      if (mounted) setState(() => _role = 'intern');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_role == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return HomeScreen(role: _role!);
  }
}