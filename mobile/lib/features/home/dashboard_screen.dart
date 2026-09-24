import 'package:flutter/material.dart';

import '../../core/current_user.dart';
import '../../core/supabase.dart';
import '../../shared/error_view.dart';
import '../../shared/format.dart';
import '../../shared/status_pill.dart';
import '../notifications/notifications_screen.dart';
import '../reports/reports_screen.dart';
import '../requests/requests_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.role});

  final String role;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _loading = true;
  String? _error;

  // intern
  Map<String, dynamic>? _today;
  List<Map<String, dynamic>> _tasks = [];
  int _unreadNotif = 0;

  // staff
  Map<String, dynamic> _stats = const {};

  String _fullName = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final supabase = SupabaseService.instance;
      final user = supabase.auth.currentUser;
      final anyName = user?.userMetadata?['full_name'];
      final pname = anyName is String ? anyName : '';

      final isIntern = widget.role == 'intern';
      final isStaff = widget.role == 'mentor' ||
          widget.role == 'admin' ||
          widget.role == 'hr';

      int unread = 0;
      List<Map<String, dynamic>> tasks = [];
      Map<String, dynamic>? today;

      if (isIntern) {
        final internId = await myInternId();
        final todayStr = DateTime.now().toIso8601String().split('T').first;
        if (internId != null) {
          final t = await supabase
              .from('attendance')
              .select('check_in_at, check_out_at, status, work_date')
              .eq('intern_id', internId)
              .eq('work_date', todayStr)
              .maybeSingle();
          today = t;
        }
        final ids = await myInternshipIds();
        if (ids.isNotEmpty) {
          final tasksRes = await supabase
              .from('tasks')
              .select('id, title, status, deadline')
              .inFilter('internship_id', ids)
              .not('status', 'is', 'done')
              .limit(5);
          tasks = List<Map<String, dynamic>>.of(tasksRes);
        }
      }

      if (isStaff || isIntern) {
        final unreadRes = await supabase
            .from('notifications')
            .select('id')
            .isFilter('read_at', null)
            .limit(100);
        unread = unreadRes.length;
      }

      Map<String, dynamic> stats = const {};
      if (widget.role == 'mentor') {
        final res = await supabase.rpc<Map<String, dynamic>>('get_mentor_stats');
        stats = res;
      } else if (widget.role == 'admin' || widget.role == 'hr') {
        final res =
            await supabase.rpc<Map<String, dynamic>>('get_dashboard_stats');
        stats = res;
      }

      if (mounted) {
        setState(() {
          _fullName = pname;
          _today = today;
          _tasks = tasks;
          _unreadNotif = unread;
          _stats = stats;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Trang chủ'),
        actions: [
          IconButton(
            tooltip: 'Thông báo',
            icon: Stack(
              clipBehavior: Clip.none,
              children: [
                const Icon(Icons.notifications_outlined),
                if (_unreadNotif > 0)
                  Positioned(
                    right: -6,
                    top: -6,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: Colors.red,
                        shape: BoxShape.circle,
                      ),
                      constraints: const BoxConstraints(
                        minWidth: 16,
                        minHeight: 16,
                      ),
                      child: Text(
                        '$_unreadNotif',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
            onPressed: () => _openNotifications(),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _Greeting(name: _fullName),
                      const SizedBox(height: 16),
                      if (widget.role == 'intern') ..._internContent(),
                      if (widget.role == 'mentor') ..._mentorContent(),
                      if (widget.role == 'admin' ||
                          widget.role == 'hr')
                        ..._adminContent(),
                    ],
                  ),
                ),
    );
  }

  List<Widget> _internContent() {
    return [
      _StatRow(
        items: [
          _StatItem(
            icon: Icons.fingerprint,
            label: 'Hôm nay',
            value: _today == null
                ? '—'
                : (statusLabels[_today!['status']] ?? 'Chưa chấm công'),
          ),
          _StatItem(
            icon: Icons.notifications,
            label: 'Chưa đọc',
            value: '$_unreadNotif',
          ),
          _StatItem(
            icon: Icons.checklist,
            label: 'Task mở',
            value: '${_tasks.length}',
          ),
        ],
      ),
      const SizedBox(height: 16),
      if (_today != null)
        Card(
          child: ListTile(
            leading: Icon(
              _today!['status'] == 'present' ? Icons.check_circle : Icons.schedule,
              color: statusColors[_today!['status']] ?? Colors.orange,
            ),
            title: const Text('Chấm công hôm nay'),
            subtitle: Text(
              'Vào: ${fmtTime(_today!['check_in_at'] as String?)} · '
              'Ra: ${fmtTime(_today!['check_out_at'] as String?)}',
            ),
          ),
        ),
      if (_tasks.isNotEmpty) ...[
        const SizedBox(height: 8),
        Text('Công việc đang mở', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        ..._tasks.map(
          (t) => Card(
            child: ListTile(
              leading: const Icon(Icons.task_alt),
              title: Text(t['title'] as String),
              subtitle: Text('Hạn: ${t['deadline'] ?? '—'}'),
              trailing: StatusPill(status: t['status'] as String),
            ),
          ),
        ),
      ],
    ];
  }

  List<Widget> _mentorContent() {
    return [
      _StatRow(
        items: [
          _StatItem(icon: Icons.people, label: 'Intern', value: '${_stats['interns'] ?? 0}'),
          _StatItem(
            icon: Icons.fact_check,
            label: 'Báo cáo chờ',
            value: '${_stats['pending_reports'] ?? 0}',
          ),
          _StatItem(
            icon: Icons.request_page,
            label: 'Đơn chờ',
            value: '${_stats['pending_requests'] ?? 0}',
          ),
          _StatItem(icon: Icons.checklist, label: 'Task mở', value: '${_stats['open_tasks'] ?? 0}'),
        ],
      ),
      const SizedBox(height: 16),
      Text('Thao tác nhanh', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 4),
      _QuickAction(
        icon: Icons.fact_check,
        title: 'Duyệt báo cáo',
        subtitle: 'Báo cáo đang chờ duyệt',
        badge: (_stats['pending_reports'] as num?)?.toInt() ?? 0,
        onTap: () => _push(const ReportsScreen(approveMode: true)),
      ),
      _QuickAction(
        icon: Icons.request_page,
        title: 'Duyệt đơn',
        subtitle: 'Đơn nghỉ / WFH / đi muộn',
        badge: (_stats['pending_requests'] as num?)?.toInt() ?? 0,
        onTap: () => _push(const RequestsScreen(approveMode: true)),
      ),
    ];
  }

  List<Widget> _adminContent() {
    return [
      _StatRow(
        items: [
          _StatItem(icon: Icons.group, label: 'Intern', value: '${_stats['total_interns'] ?? 0}'),
          _StatItem(
            icon: Icons.fingerprint,
            label: 'Chấm công %',
            value: '${_stats['attendance_rate'] ?? 0}%',
          ),
          _StatItem(
            icon: Icons.task_alt,
            label: 'Task %',
            value: '${_stats['task_completion_rate'] ?? 0}%',
          ),
          _StatItem(
            icon: Icons.star,
            label: 'ĐG TB',
            value: '${_stats['avg_evaluation'] ?? 0}',
          ),
        ],
      ),
    ];
  }

  void _openNotifications() {
    Navigator.of(context).push(
      MaterialPageRoute(
        settings: const RouteSettings(name: NotificationsScreen.routeName),
        builder: (_) => const NotificationsScreen(),
      ),
    );
  }

  void _push(Widget screen) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.badge,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final int badge;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: ListTile(
        onTap: onTap,
        leading: CircleAvatar(
          backgroundColor: scheme.primaryContainer,
          foregroundColor: scheme.primary,
          child: Icon(icon),
        ),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: badge > 0
            ? Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: scheme.error,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '$badge',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                ),
              )
            : const Icon(Icons.chevron_right),
      ),
    );
  }
}

class _Greeting extends StatelessWidget {
  const _Greeting({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    final hour = DateTime.now().hour;
    final greeting = hour < 12
        ? 'Chào buổi sáng'
        : hour < 18
            ? 'Chào buổi chiều'
            : 'Chào buổi tối';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(greeting,
            style: Theme.of(context).textTheme.headlineSmall),
        if (name.isNotEmpty)
          Text(name,
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(color: Colors.grey)),
      ],
    );
  }
}

class _StatRow extends StatelessWidget {
  const _StatRow({required this.items});

  final List<_StatItem> items;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: items.length > 3 ? 4 : 3,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 0.9,
      children: items,
    );
  }
}

class _StatItem extends StatelessWidget {
  const _StatItem({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 4),
            Text(value,
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.bold)),
            Text(label,
                style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}