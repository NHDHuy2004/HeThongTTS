import 'package:flutter/material.dart';

import '../../core/supabase.dart';
import '../../shared/empty_view.dart';
import '../../shared/error_view.dart';
import '../../shared/format.dart';
import '../../shared/status_pill.dart';
import 'task_detail_screen.dart';

/// Danh sách công việc: staff xem task mình giao/quản lý,
/// intern xem task mình được phân công (RLS tự lọc).
class TasksScreen extends StatefulWidget {
  const TasksScreen({super.key, required this.role});

  final String role;

  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  List<Map<String, dynamic>> _tasks = [];
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
      final supabase = SupabaseService.instance;
      final rows = await supabase
          .from('tasks')
          .select(
            'id, title, status, priority, deadline, assignment_type, '
            'internships(interns(full_name)), '
            'task_assignees(interns(full_name))',
          )
          .order('created_at', ascending: false)
          .limit(100);
      if (mounted) {
        setState(() => _tasks = List<Map<String, dynamic>>.of(rows));
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _assignees(Map<String, dynamic> row) {
    final list = (row['task_assignees'] as List?) ?? [];
    final names =
        list.map((a) => ((a as Map)['interns'] as Map?)?['full_name'] as String?).toList();
    final valid = names.whereType<String>().toList();
    if (valid.isNotEmpty) return valid.join(', ');
    final intern = ((row['internships'] as Map?)?['interns']) as Map?;
    return (intern?['full_name'] as String?) ?? '—';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Công việc')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _tasks.isEmpty
                      ? const SingleChildScrollView(
                          physics: AlwaysScrollableScrollPhysics(),
                          child: SizedBox(
                            height: 400,
                            child: EmptyView(
                              icon: Icons.task_alt,
                              message: 'Chưa có công việc nào.',
                            ),
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _tasks.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 10),
                          itemBuilder: (context, i) => _card(_tasks[i]),
                        ),
                ),
    );
  }

  Widget _card(Map<String, dynamic> t) {
    final id = t['id'] as String;
    final isTeam = t['assignment_type'] == 'team';
    return Card(
      margin: EdgeInsets.zero,
      child: ListTile(
        onTap: () => Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => TaskDetailScreen(taskId: id, role: widget.role),
        )),
        title: Row(
          children: [
            Expanded(
              child: Text(
                t['title'] as String,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (isTeam)
              const Padding(
                padding: EdgeInsets.only(right: 6),
                child: Icon(Icons.groups, size: 16, color: Colors.blueGrey),
              ),
            StatusPill(status: t['status'] as String? ?? 'not_started'),
          ],
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Phụ trách: ${_assignees(t)}'),
              const SizedBox(height: 2),
              Row(
                children: [
                  StatusPill(status: t['priority'] as String? ?? 'medium'),
                  const Spacer(),
                  Text(
                    'Hạn: ${fmtDateTime(t['deadline'] as String?)}',
                    style: const TextStyle(fontSize: 12),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}