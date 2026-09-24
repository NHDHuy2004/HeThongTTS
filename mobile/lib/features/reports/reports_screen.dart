import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/fcm.dart';
import '../../core/supabase.dart';
import '../../shared/empty_view.dart';
import '../../shared/error_view.dart';
import '../../shared/format.dart';
import '../../shared/status_pill.dart';

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
  String? _error;

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
    setState(() {
      _loading = true;
      _error = null;
    });
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
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
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

  Future<void> _review(Map<String, dynamic> r, String status) async {
    final supabase = SupabaseService.instance;
    try {
      final id = r['id'] as String;
      await supabase.from('daily_reports').update({
        'status': status,
        'reviewed_by': _userId,
        'reviewed_at': DateTime.now().toIso8601String(),
      }).eq('id', id);
      unawaited(FcmService.notifyReview(
        internId: r['intern_id'] as String,
        type: status == 'approved' ? 'report_approved' : 'report_rejected',
        title: 'Báo cáo',
        body: 'Báo cáo ${fmtDbDate(r['report_date'] as String?)} ${
            status == 'approved' ? 'đã được duyệt.' : 'đã bị từ chối.'}',
        data: {
          'table': 'daily_reports',
          'id': id,
          'notification_id': id,
        },
      ));
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
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (!widget.approveMode) ...[
                        TextField(
                          controller: _content,
                          maxLines: 3,
                          decoration: const InputDecoration(
                            labelText: 'Công việc đã làm hôm nay',
                          ),
                        ),
                        const SizedBox(height: 8),
                        FilledButton(
                          onPressed: _busy ? null : _submit,
                          child: Text(_busy ? 'Đang gửi...' : 'Gửi báo cáo'),
                        ),
                        const SizedBox(height: 16),
                      ],
                      if (_reports.isEmpty && widget.approveMode)
                        const Padding(
                          padding: EdgeInsets.only(top: 80),
                          child: EmptyView(
                            icon: Icons.fact_check,
                            message: 'Chưa có báo cáo chờ duyệt.',
                          ),
                        ),
                      ..._reports.map((r) => _card(r)),
                    ],
                  ),
                ),
    );
  }

  Widget _card(Map<String, dynamic> r) {
    final canReview =
        widget.approveMode && (r['status'] == 'submitted');
    return Card(
      child: ListTile(
        isThreeLine: true,
        title: Row(
          children: [
            Expanded(
              child: Text(fmtDbDate(r['report_date'] as String?)),
            ),
            StatusPill(status: r['status'] as String),
          ],
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              (r['tasks_done'] ?? r['results'] ?? 'Không có nội dung')
                  as String,
            ),
            const SizedBox(height: 4),
            if (r['feedback'] != null)
              Text('Phản hồi: ${r['feedback']}',
                  style: const TextStyle(fontSize: 12)),
            if (canReview) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  FilledButton(
                    onPressed: () => _review(r, 'approved'),
                    child: const Text('Duyệt'),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton(
                    onPressed: () => _review(r, 'rejected'),
                    child: const Text('Từ chối'),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}