import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/realtime.dart';
import '../../core/supabase.dart';
import '../../shared/empty_view.dart';
import '../../shared/error_view.dart';
import '../../shared/skeleton.dart';
import '../../shared/format.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  static const routeName = '/notifications';

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen>
    with WidgetsBindingObserver {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String? _error;
  StreamSubscription<Map<String, dynamic>>? _notifSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
    _notifSub = RealtimeService.instance.notifications.listen((rec) {
      if (!mounted) return;
      setState(() {
        final exists = _items.any((n) => n['id'] == rec['id']);
        if (!exists) _items.insert(0, rec);
      });
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _notifSub?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await SupabaseService.instance
          .from('notifications')
          .select('*')
          .order('created_at', ascending: false)
          .limit(100);
      if (mounted) {
        setState(() => _items = List<Map<String, dynamic>>.of(rows));
      }
    } catch (e) {
      if (!mounted) return;
      debugPrint('Notifications load failed: $e');
      setState(() => _error = 'Không thể tải dữ liệu. Vui lòng thử lại.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markRead(String id) async {
    await SupabaseService.instance
        .from('notifications')
        .update({'read_at': DateTime.now().toIso8601String()}).eq('id', id);
    await _load();
  }

  Future<void> _delete(String id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xóa thông báo?'),
        content: const Text('Thông báo này sẽ bị xóa vĩnh viễn.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await SupabaseService.instance.from('notifications').delete().eq('id', id);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Thông báo')),
      body: _loading
          ? const SkeletonListView()
          : RefreshIndicator(
              onRefresh: _load,
              child: _error != null
                  ? SingleChildScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      child: SizedBox(
                        height: 400,
                        child: ErrorView(message: _error!, onRetry: _load),
                      ),
                    )
                  : _items.isEmpty
                      ? const SingleChildScrollView(
                          physics: AlwaysScrollableScrollPhysics(),
                          child: SizedBox(
                            height: 400,
                            child: EmptyView(
                              icon: Icons.notifications_none,
                              message: 'Chưa có thông báo nào.',
                            ),
                          ),
                        )
                      : ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: _items.map((n) {
                          final isUnread = n['read_at'] == null;
                          return ListTile(
                            leading: Icon(
                              isUnread
                                  ? Icons.circle
                                  : Icons.circle_outlined,
                              color: isUnread
                                  ? Theme.of(context).colorScheme.primary
                                  : Colors.grey,
                            ),
                            title: Text(
                              n['title'] as String,
                              style: TextStyle(
                                fontWeight: isUnread
                                    ? FontWeight.bold
                                    : FontWeight.normal,
                              ),
                            ),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(n['body']?.toString() ?? ''),
                                Text(
                                  fmtTime(n['created_at'] as String?),
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Theme.of(context)
                                        .colorScheme
                                        .outline,
                                  ),
                                ),
                              ],
                            ),
                            trailing: IconButton(
                              icon: const Icon(Icons.delete_outline),
                              onPressed: () => _delete(n['id'] as String),
                            ),
                            onTap: isUnread
                                ? () => _markRead(n['id'] as String)
                                : null,
                          );
                        }).toList(),
                      ),
                    ),
    );
  }
}