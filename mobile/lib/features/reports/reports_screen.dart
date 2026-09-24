import 'package:flutter/material.dart';

import '../../core/supabase.dart';

/// Intern gửi báo cáo ngày; staff (mentor/hr/admin) duyệt báo cáo.
class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key, this.approveMode = false});

  final bool approveMode;

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  List<Map<String, dynamic>> _reports = [];
  final _content = TextEditingController();
  String? _internId;
  String? _userId;
  bool _busy = false;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final supabase = SupabaseService.instance;
    _userId = supabase.auth.currentUser?.id;

    if (!widget.approveMode) {
      final uid = _userId;
      if (uid != null) {
        final intern = await supabase
            .from('interns')
            .select('id')
            .eq('user_id', uid)
            .maybeSingle();
        _internId = intern?['id'] as String?;
      }
    }
    await _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final supabase = SupabaseService.instance;
      var query = supabase.from('daily_reports').select('*');
      if (!widget.approveMode && _internId != null) {
        query = query.eq('intern_id', _internId!);
      }
      final rows =
          await query.order('report_date', ascending: false).limit(50);
      if (mounted) {
        setState(() => _reports = List<Map<String, dynamic>>.of(rows));
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    final content = _content.text.trim();
    if (content.isEmpty || _internId == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Chưa có hồ sơ intern để gửi báo cáo.')),
        );
      }
      return;
    }
    final supabase = SupabaseService.instance;
    setState(() => _busy = true);
    try {
      final now = DateTime.now();
      await supabase.from('daily_reports').insert({
        'intern_id': _internId,
        'report_date': now.toIso8601String().split('T').first,
        'tasks_done': content,
        'status': 'submitted',
        'submitted_at': now.toIso8601String(),
      });
      _content.clear();
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _review(String id, String status) async {
    final supabase = SupabaseService.instance;
    try {
      await supabase.from('daily_reports').update({
        'status': status,
        'reviewed_by': _userId,
        'reviewed_at': DateTime.now().toIso8601String(),
      }).eq('id', id);
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.approveMode ? 'Duyệt báo cáo' : 'Báo cáo ngày'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (!widget.approveMode) ...[
                  TextField(
                    controller: _content,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Công việc đã làm hôm nay',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: _busy ? null : _submit,
                    child: Text(_busy ? 'Đang gửi...' : 'Gửi báo cáo'),
                  ),
                  const SizedBox(height: 16),
                ],
                ..._reports.map(
                  (r) => Card(
                    child: ListTile(
                      isThreeLine: true,
                      title: Text('${r['report_date']}'),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text((r['tasks_done'] ?? r['results'] ?? 'Không có nội dung') as String),
                          const SizedBox(height: 4),
                          _StatusPill(status: r['status'] as String),
                          if (r['feedback'] != null)
                            Text('Phản hồi: ${r['feedback']}',
                                style: const TextStyle(fontSize: 12)),
                        ],
                      ),
                      trailing: widget.approveMode &&
                              (r['status'] == 'submitted')
                          ? PopupMenuButton<String>(
                              onSelected: (v) => _review(r['id'] as String, v),
                              itemBuilder: (_) => const [
                                PopupMenuItem(value: 'approved', child: Text('Duyệt')),
                                PopupMenuItem(value: 'rejected', child: Text('Từ chối')),
                              ],
                            )
                          : null,
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      'approved' => Colors.green,
      'rejected' => Colors.red,
      'submitted' => Colors.orange,
      _ => Colors.blueGrey,
    };
    return Text(
      status.toUpperCase(),
      style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600),
    );
  }
}