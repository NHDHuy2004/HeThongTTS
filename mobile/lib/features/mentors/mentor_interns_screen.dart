import 'package:flutter/material.dart';

import '../../core/supabase.dart';
import '../../shared/empty_view.dart';
import '../../shared/error_view.dart';
import '../../shared/skeleton.dart';
import '../../shared/status_pill.dart';
import '../reports/reports_screen.dart';
import '../requests/requests_screen.dart';
import '../tasks/tasks_screen.dart';

/// Danh sách thực tập sinh đang phụ trách (mentor).
/// RLS tự giới hạn chỉ thấy intern của mình — không cần lọc thêm.
class MentorInternsScreen extends StatefulWidget {
  const MentorInternsScreen({super.key});

  @override
  State<MentorInternsScreen> createState() => _MentorInternsScreenState();
}

class _MentorInternsScreenState extends State<MentorInternsScreen> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String? _error;

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
      final rows = await SupabaseService.instance
          .from('internships')
          .select('''
            id, status, start_date, end_date,
            interns(id, full_name, student_code, email),
            departments(name),
            internship_batches(name)
          ''')
          .order('start_date', ascending: false)
          .limit(100);
      if (!mounted) return;
      setState(() {
        _items = rows.map((r) => Map<String, dynamic>.from(r)).toList();
      });
    } catch (e) {
      if (!mounted) return;
      debugPrint('Mentor interns load failed: $e');
      setState(() {
        _error = 'Không thể tải danh sách thực tập sinh. Vui lòng thử lại.';
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openDetail(Map<String, dynamic> row) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: MediaQuery.of(context).viewInsets.bottom + 16,
        ),
        child: _InternDetail(row: row),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Intern phụ trách')),
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
                              icon: Icons.group_outlined,
                              message:
                                  'Bạn chưa được phân công thực tập sinh nào.',
                            ),
                          ),
                        )
                      : ListView.separated(
                          physics: const AlwaysScrollableScrollPhysics(),
                          itemCount: _items.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          padding: const EdgeInsets.all(12),
                          itemBuilder: (context, i) {
                            final row = _items[i];
                            final intern =
                                row['interns'] as Map<String, dynamic>?;
                            final dept =
                                row['departments'] as Map<String, dynamic>?;
                            final batch =
                                row['internship_batches'] as Map<String, dynamic>?;
                            return Card(
                              margin: EdgeInsets.zero,
                              child: ListTile(
                                title: Text(
                                  (intern?['full_name'] ?? '—').toString(),
                                ),
                                subtitle: Text(
                                  [
                                    if (intern?['student_code'] != null)
                                      intern!['student_code'],
                                    if (dept?['name'] != null) dept!['name'],
                                    if (batch?['name'] != null) batch!['name'],
                                  ].join(' · '),
                                ),
                                trailing: StatusPill(
                                  status:
                                      (row['status'] ?? 'active').toString(),
                                ),
                                onTap: () => _openDetail(row),
                              ),
                            );
                          },
                        ),
            ),
    );
  }
}

class _InternDetail extends StatelessWidget {
  const _InternDetail({required this.row});

  final Map<String, dynamic> row;

  @override
  Widget build(BuildContext context) {
    final intern = row['interns'] as Map<String, dynamic>?;
    final dept = row['departments'] as Map<String, dynamic>?;
    final batch = row['internship_batches'] as Map<String, dynamic>?;
    final name = (intern?['full_name'] ?? '—').toString();

    return SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  name,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              StatusPill(status: (row['status'] ?? 'active').toString()),
            ],
          ),
          const SizedBox(height: 8),
          if (intern?['student_code'] != null)
            Text('MSSV: ${intern!['student_code']}'),
          if (intern?['email'] != null) Text('Email: ${intern!['email']}'),
          if (dept?['name'] != null) Text('Phòng ban: ${dept!['name']}'),
          if (batch?['name'] != null) Text('Đợt: ${batch!['name']}'),
          if (row['start_date'] != null)
            Text('Bắt đầu: ${row['start_date']}'),
          const SizedBox(height: 16),
          ListTile(
            leading: const Icon(Icons.task_alt),
            title: const Text('Xem công việc'),
            subtitle: const Text('Task được giao cho intern này'),
            onTap: () {
              Navigator.of(context).pop();
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const TasksScreen(role: 'mentor'),
                ),
              );
            },
          ),
          ListTile(
            leading: const Icon(Icons.fact_check),
            title: const Text('Duyệt báo cáo'),
            onTap: () {
              Navigator.of(context).pop();
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const ReportsScreen(approveMode: true),
                ),
              );
            },
          ),
          ListTile(
            leading: const Icon(Icons.request_page),
            title: const Text('Duyệt đơn từ'),
            onTap: () {
              Navigator.of(context).pop();
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const RequestsScreen(approveMode: true),
                ),
              );
            },
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
