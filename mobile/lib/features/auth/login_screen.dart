import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/fcm.dart';
import '../../core/supabase.dart';
import '../home/home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _obscurePassword = true;
  String? _error;
  String? _emailError;
  String? _passwordError;

  static final _emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  bool _validate() {
    final email = _email.text.trim();
    final password = _password.text;
    setState(() {
      _emailError = email.isEmpty
          ? 'Vui lòng nhập email.'
          : !_emailRegex.hasMatch(email)
              ? 'Email không hợp lệ.'
              : null;
      _passwordError = password.isEmpty ? 'Vui lòng nhập mật khẩu.' : null;
    });
    return _emailError == null && _passwordError == null;
  }

  String _friendlyError(Object e) {
    final msg = e.toString();
    if (msg.contains('Invalid login credentials')) {
      return 'Email hoặc mật khẩu không đúng.';
    }
    if (msg.contains('Email not confirmed')) {
      return 'Email chưa được xác nhận. Vui lòng kiểm tra hộp thư.';
    }
    if (msg.contains('Too many requests') || msg.contains('rate limit')) {
      return 'Thao tác quá nhanh. Vui lòng thử lại sau ít phút.';
    }
    return 'Đăng nhập thất bại. Vui lòng thử lại.';
  }

  Future<void> _login() async {
    if (!_validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await SupabaseService.instance.auth.signInWithPassword(
        email: _email.text.trim(),
        password: _password.text,
      );
      unawaited(FcmService.registerDevice());
      if (!mounted) return;
      String? role;
      try {
        role = await SupabaseService.instance.rpc<String>('get_my_role');
      } catch (_) {
        role = 'intern';
      }
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => HomeScreen(role: role ?? 'intern')),
      );
    } catch (e) {
      if (!mounted) return;
      debugPrint('Login failed: $e');
      setState(() => _error = _friendlyError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.school_outlined, size: 64, color: Colors.indigo),
                const SizedBox(height: 8),
                Text(
                  'Hệ thống Thực tập',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  onChanged: (_) => setState(() => _emailError = null),
                  decoration: InputDecoration(
                    labelText: 'Email',
                    prefixIcon: const Icon(Icons.mail_outline),
                    border: const OutlineInputBorder(),
                    errorText: _emailError,
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _password,
                  obscureText: _obscurePassword,
                  onChanged: (_) => setState(() => _passwordError = null),
                  decoration: InputDecoration(
                    labelText: 'Mật khẩu',
                    prefixIcon: const Icon(Icons.lock_outline),
                    border: const OutlineInputBorder(),
                    errorText: _passwordError,
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                      ),
                      onPressed: () => setState(
                        () => _obscurePassword = !_obscurePassword,
                      ),
                    ),
                  ),
                  onSubmitted: (_) => _login(),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    style: TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ],
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _busy ? null : _login,
                  child: _busy
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Đăng nhập'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}