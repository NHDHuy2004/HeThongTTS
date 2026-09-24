import 'dart:async';

import 'package:flutter/material.dart';

import 'core/fcm.dart';
import 'core/supabase.dart';
import 'features/auth/login_screen.dart';
import 'features/home/home_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SupabaseService.initialize();
  unawaited(FcmService.init());
  runApp(const HeThongTtsApp());
}

class HeThongTtsApp extends StatelessWidget {
  const HeThongTtsApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Hệ thống Thực tập',
      debugShowCheckedModeBanner: false,
      navigatorKey: FcmService.navigatorKey,
      theme: theme,
      home: const AuthGate(),
    );
  }
}

const _seed = Color(0xFF3F51B5);

ThemeData get theme {
  final scheme = ColorScheme.fromSeed(seedColor: _seed);
  return ThemeData(
    colorScheme: scheme,
    useMaterial3: true,
    scaffoldBackgroundColor: const Color(0xFFF4F5FA),
    appBarTheme: AppBarTheme(
      backgroundColor: scheme.surface,
      elevation: 0,
      scrolledUnderElevation: 0.5,
    ),
    cardTheme: const CardThemeData(
      elevation: 0,
      margin: EdgeInsets.symmetric(vertical: 6),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(14)),
        side: BorderSide(color: Color(0xFFE4E6EF)),
      ),
    ),
    inputDecorationTheme: const InputDecorationTheme(
      border: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(12)),
      ),
      contentPadding:
          EdgeInsets.symmetric(horizontal: 12, vertical: 12),
    ),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        padding: const EdgeInsets.symmetric(vertical: 12),
      ),
    ),
  );
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