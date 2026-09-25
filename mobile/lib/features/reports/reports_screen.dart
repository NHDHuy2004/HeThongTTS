import 'package:flutter/material.dart';

import '../../core/supabase.dart';
import '../../shared/empty_view.dart';
import '../../shared/error_view.dart';
import '../../shared/format.dart';
import '../../shared/status_pill.dart';

const _typeLabels = <String, String>{
  'daily': 'Báo cáo ngày',
  'weekly': 'Báo cáo tuần',
  'monthly': 'Báo cáo tháng',
  'final': 'Báo cáo tổng kết',
};

class _Field {
  const _Field(this.key, this.label, {this.required = false});
  final String key;
  final String label;
  final bool required;
}

const _fieldsByType = <String, List<_Field>>{
  'daily': [
    _Field('work_done', 'Công việc đã thực hiện', required: true),
    _Field('work_time', 'Thời gian làm việc'),
    _Field('results', 'Kết quả đạt được', required: true),
    _Field('difficulties', 'Khó khăn gặp phải'),
    _Field('solution', 'Cách giải quyết'),
    _Field('next_plan', 'Kế hoạch ngày tiếp theo'),
    _Field('note', 'Ghi chú'),
  ],
  'weekly': [
    _Field('completed_tasks', 'Nhiệm vụ đã hoàn thành', required: true),
    _Field('in_progress_tasks', 'Nhiệm vụ đang thực hiện'),
    _Field('progress', 'Tiến độ công việc'),
    _Field('results', 'Kết quả đạt được', required: true),
    _Field('difficulties', 'Khó khăn gặp phải'),
    _Field('solution', 'Cách giải quyết'),
    _Field('skills_learned', 'Kiến thức / kỹ năng học được'),
    _Field('next_plan', 'Kế hoạch tuần tiếp theo'),
    _Field('self_evaluation', 'Tự đánh giá'),
  ],
  'monthly': [
    _Field('completed_work', 'Công việc đã hoàn thành', required: true),
    _Field('progress', 'Tiến độ các nhiệm vụ'),
    _Field('highlights', 'Kết quả nổi bật', required: true),
    _Field('skills_developed', 'Kỹ năng chuyên môn phát triển'),
    _Field('difficulties', 'Khó khăn gặp phải'),
    _Field('goal_completion', 'Mức độ hoàn thành mục tiêu'),
    _Field('next_plan', 'Kế hoạch tháng tiếp theo'),
    _Field('comments', 'Nhận xét của thực tập sinh'),
  ],
  'final': [
    _Field('goals', 'Mục tiêu ban đầu', required: true),
    _Field('work_content', 'Nội dung công việc', required: true),
    _Field('notable_projects', 'Dự án / nhiệm vụ tiêu biểu'),
    _Field('results', 'Kết quả đạt được', required: true),
    _Field('hard_skills', 'Kỹ năng chuyên môn'),
    _Field('soft_skills', 'Kỹ năng mềm'),
    _Field('difficulties', 'Khó khăn và cách giải quyết'),
    _Field('lessons', 'Bài học kinh nghiệm'),
    _Field('self_evaluation', 'Tự đánh giá', required: true),
    _Field('future_direction', 'Định hướng phát triển'),
  ],
};

const _reportSelect =
    '*, interns(full_name, student_code), profiles!reports_reviewed_by_fkey(full_name)';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key, this.approveMode = false});

  final bool approveMode;

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  List<Map<String, dynamic>> _reports = [];
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
          .from('reports')
          .select(_reportSelect)
          .order('period_start', ascending: false)
          .limit(100);
      if (!mounted) return;
      setState(() {
        _reports = rows.map((r) => Map<String, dynamic>.from(r)).toList();
      });
    } catch (e) {
      if (!mounted) return;
      final msg = e.toString();
      setState(() {
        _error = msg.contains('Could not find the table')
            ? 'Chưa chạy migration 0018_reports_management.sql — hãy chạy trong Supabase Dashboard.'
            : msg;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openCreate() {
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
        child: _ReportForm(onChanged: _load),
      ),
    );
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
        child: _ReportDetail(
          row: row,
          approveMode: widget.approveMode,
          onChanged: _load,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.approveMode ? 'Duyệt báo cáo' : 'Báo cáo thực tập'),
      ),
      floatingActionButton: widget.approveMode
          ? null
          : FloatingActionButton.extended(
              onPressed: _openCreate,
              icon: const Icon(Icons.add),
              label: const Text('Tạo báo cáo'),
            ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : _reports.isEmpty
                  ? const EmptyView(
                      icon: Icons.fact_check,
                      message: 'Chưa có báo cáo nào.',
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView(
                        padding: const EdgeInsets.only(bottom: 88),
                        children: _reports.map(_card).toList(),
                      ),
                    ),
    );
  }

  Widget _card(Map<String, dynamic> row) {
    final type = (row['report_type'] ?? '').toString();
    final status = (row['status'] ?? 'draft').toString();
    final internName =
        (row['interns'] as Map<String, dynamic>?)?['full_name'] as String?;
    final late = row['is_late'] == true;

    final start = row['period_start'] as String?;
    final end = row['period_end'] as String?;
    final period = start == null
        ? '—'
        : (end == null || end == start)
            ? fmtDbDate(start)
            : '${fmtDbDate(start)} → ${fmtDbDate(end)}';

    final overdue = (row['due_date'] as String?) != null &&
        ['draft', 'submitted', 'in_review', 'needs_revision'].contains(status) &&
        (row['due_date'] as String).compareTo(_today()) < 0;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: InkWell(
        onTap: () => _openDetail(row),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      (row['title'] ?? _typeLabels[type] ?? type).toString(),
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  StatusPill(status: status),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                '${(row['report_code'] ?? '').toString()} · '
                '${_typeLabels[type] ?? type}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              Text('Kỳ: $period'),
              if (row['due_date'] != null)
                Text(
                  'Hạn nộp: ${fmtDbDate(row['due_date'] as String?)}'
                  '${overdue ? ' (quá hạn)' : ''}',
                  style: overdue
                      ? TextStyle(color: Theme.of(context).colorScheme.error)
                      : null,
                ),
              if (late) const Text('Nộp muộn'),
              if (internName != null) Text('Thực tập sinh: $internName'),
              if (row['submitted_at'] != null)
                Text('Nộp lúc: ${fmtDateTime(row['submitted_at'] as String?)}'),
              if (row['review_comment'] != null)
                Text('Nhận xét: ${row['review_comment']}'),
              if (row['revision_note'] != null)
                Text('Cần chỉnh sửa: ${row['revision_note']}'),
              if (row['rejection_reason'] != null)
                Text(
                  'Từ chối: ${row['rejection_reason']}',
                  style:
                      TextStyle(color: Theme.of(context).colorScheme.error),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

String _today() => DateTime.now().toIso8601String().split('T').first;

class _ReportForm extends StatefulWidget {
  const _ReportForm({this.existing, required this.onChanged});

  final Map<String, dynamic>? existing;
  final VoidCallback onChanged;

  @override
  State<_ReportForm> createState() => _ReportFormState();
}

class _ReportFormState extends State<_ReportForm> {
  String _type = 'daily';
  late final TextEditingController _title;
  late DateTime _start;
  late DateTime _end;
  DateTime? _due;
  final _content = <String, TextEditingController>{};
  final _links = TextEditingController();
  bool _busy = false;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    _type = (existing?['report_type'] ?? 'daily').toString();
    _title = TextEditingController(text: (existing?['title'] ?? '').toString());
    _start = _parseDate(existing?['period_start']) ?? DateTime.now();
    _end = _parseDate(existing?['period_end']) ?? _start;
    _due = _parseDate(existing?['due_date']);
    final content = existing?['content'];
    if (content is Map<String, dynamic>) {
      for (final e in content.entries) {
        _content[e.key.toString()] =
            TextEditingController(text: e.value?.toString() ?? '');
      }
    }
    final links = existing?['links'];
    if (links is List) {
      _links.text = links
          .map((l) => l is Map
              ? ((l['label'] ?? l['url'] ?? '').toString().isEmpty
                  ? (l['url'] ?? '').toString()
                  : '${l['url']} - ${l['label']}')
              : l.toString())
          .where((s) => s.isNotEmpty)
          .join('\n');
    }
  }

  DateTime? _parseDate(dynamic value) {
    if (value is! String || value.isEmpty) return null;
    return DateTime.tryParse(value.split('T').first);
  }

  @override
  void dispose() {
    _title.dispose();
    for (final c in _content.values) {
      c.dispose();
    }
    _links.dispose();
    super.dispose();
  }

  List<_Field> get _fields => _fieldsByType[_type] ?? const [];

  TextEditingController _field(String key) =>
      _content.putIfAbsent(key, () => TextEditingController());

  String _fmtDate(DateTime d) => d.toIso8601String().split('T').first;

  Future<void> _pickDate({required bool isStart}) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: isStart ? _start : _end,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _start = picked;
          if (_end.isBefore(picked)) _end = picked;
        } else {
          _end = picked;
        }
      });
    }
  }

  Future<void> _pickDue() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _due ?? _end,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );
    if (picked != null) setState(() => _due = picked);
  }

  Map<String, String> _buildContent() {
    final out = <String, String>{};
    for (final f in _fields) {
      final value = _field(f.key).text.trim();
      if (value.isNotEmpty) out[f.key] = value;
    }
    return out;
  }

  List<Map<String, String>> _buildLinks() {
    final out = <Map<String, String>>[];
    for (final raw in _links.text.split('\n')) {
      final line = raw.trim();
      if (line.isEmpty) continue;
      final idx = line.indexOf('http');
      if (idx != 0) continue;
      final dash = line.indexOf(RegExp(r'\s[-–—:]\s'));
      if (dash > 0) {
        out.add({
          'url': line.substring(0, dash).trim(),
          'label': line.substring(dash + 1).trim(),
        });
      } else {
        out.add({'url': line});
      }
    }
    return out;
  }

  Future<void> _submit({required bool publish}) async {
    final title = _title.text.trim();
    if (title.length < 5) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Tiêu đề báo cáo phải có ít nhất 5 ký tự.')),
      );
      return;
    }
    if (publish) {
      final content = _buildContent();
      final missing =
          _fields.where((f) => f.required && !(content[f.key]?.isNotEmpty ?? false));
      if (missing.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content:
                  Text('Bắt buộc điền: ${missing.map((f) => f.label).join(', ')}.')),
        );
        return;
      }
    }

    setState(() => _busy = true);
    try {
      final supabase = SupabaseService.instance;
      final content = _buildContent();
      final links = _buildLinks();

      final Map<String, dynamic> result;
      if (_isEdit) {
        result = await supabase.rpc<Map<String, dynamic>>(
          'update_report',
          params: {
            'p_report_id': widget.existing!['id'],
            'p_title': title,
            'p_period_start': _fmtDate(_start),
            'p_period_end': _fmtDate(_end),
            'p_content': content,
            'p_links': links,
            'p_task_ids': const <dynamic>[],
            'p_due_date': _due == null ? null : _fmtDate(_due!),
            'p_attachment_paths': _existingPaths(),
            'p_submit': publish,
          },
        );
      } else {
        result = await supabase.rpc<Map<String, dynamic>>(
          'create_report',
          params: {
            'p_report_type': _type,
            'p_title': title,
            'p_period_start': _fmtDate(_start),
            'p_period_end': _fmtDate(_end),
            'p_content': content,
            'p_links': links,
            'p_task_ids': const <dynamic>[],
            'p_due_date': _due == null ? null : _fmtDate(_due!),
            'p_attachment_paths': const <dynamic>[],
            'p_submit': publish,
          },
        );
      }

      if (result['success'] != true) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                  (result['message'] ?? 'Không thể lưu báo cáo').toString()),
            ),
          );
        }
        return;
      }

      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content:
                Text((result['message'] ?? 'Đã lưu báo cáo').toString()),
          ),
        );
      }
      widget.onChanged();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  List<dynamic> _existingPaths() {
    final attachments = widget.existing?['report_attachments'];
    if (attachments is List) {
      return attachments
          .map((a) => a is Map ? a['file_path'] : null)
          .whereType<String>()
          .toList();
    }
    return const <dynamic>[];
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _isEdit ? 'Chỉnh sửa báo cáo' : 'Tạo báo cáo',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 12),
          if (!_isEdit) ...[
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _typeLabels.entries
                  .map(
                    (e) => ChoiceChip(
                      label: Text(e.value),
                      selected: _type == e.key,
                      onSelected: (_) => setState(() {
                        _type = e.key;
                        _content.clear();
                      }),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 12),
          ],
          TextField(
            controller: _title,
            decoration: const InputDecoration(
              labelText: 'Tiêu đề *',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.event),
                  label: Text('Kỳ từ: ${_fmtDate(_start)}'),
                  onPressed: () => _pickDate(isStart: true),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.event),
                  label: Text('Đến: ${_fmtDate(_end)}'),
                  onPressed: () => _pickDate(isStart: false),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            icon: const Icon(Icons.alarm),
            label: Text(
                'Hạn nộp: ${_due == null ? 'theo cấu hình' : _fmtDate(_due!)}'),
            onPressed: _pickDue,
          ),
          const SizedBox(height: 12),
          ..._fields.map(
            (f) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: TextField(
                controller: _field(f.key),
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: '${f.label}${f.required ? ' *' : ''}',
                  border: const OutlineInputBorder(),
                ),
              ),
            ),
          ),
          TextField(
            controller: _links,
            maxLines: 2,
            decoration: const InputDecoration(
              labelText: 'Liên kết (mỗi dòng1 URL)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _busy ? null : () => _submit(publish: false),
                  child: Text(_busy ? 'Đang lưu...' : 'Lưu nháp'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton(
                  onPressed: _busy ? null : () => _submit(publish: true),
                  child: Text(_busy ? 'Đang gửi...' : 'Nộp báo cáo'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _ReportDetail extends StatefulWidget {
  const _ReportDetail({
    required this.row,
    required this.approveMode,
    required this.onChanged,
  });

  final Map<String, dynamic> row;
  final bool approveMode;
  final VoidCallback onChanged;

  @override
  State<_ReportDetail> createState() => _ReportDetailState();
}

class _ReportDetailState extends State<_ReportDetail> {
  final _comment = TextEditingController();
  bool _busy = false;
  late Map<String, dynamic> _row;

  @override
  void initState() {
    super.initState();
    _row = Map<String, dynamic>.from(widget.row);
  }

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  String get _status => (_row['status'] ?? 'draft').toString();

  bool get _canEdit =>
      _status == 'draft' || _status == 'needs_revision';

  Future<void> _action(String action,
      {bool requireComment = false, bool confirm = false}) async {
    final comment = _comment.text.trim();
    if (requireComment && comment.length < 5) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Vui lòng nhập lý do (tối thiểu 5 ký tự).')),
      );
      return;
    }
    if (confirm && !(await _confirm(action))) return;

    setState(() => _busy = true);
    try {
      final supabase = SupabaseService.instance;
      final Map<String, dynamic> result;
      if (action == 'submit') {
        result = await supabase.rpc<Map<String, dynamic>>(
          'submit_report',
          params: {'p_report_id': _row['id']},
        );
      } else {
        result = await supabase.rpc<Map<String, dynamic>>(
          'review_report',
          params: {
            'p_report_id': _row['id'],
            'p_action': action,
            'p_comment': comment.isEmpty ? null : comment,
          },
        );
      }
      if (!mounted) return;
      if (result['success'] != true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content:
                Text((result['message'] ?? 'Không thể xử lý báo cáo').toString()),
          ),
        );
        return;
      }
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text((result['message'] ?? 'Đã cập nhật').toString())),
      );
      widget.onChanged();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool> _confirm(String action) async {
    final text = switch (action) {
      'approve' => 'Phê duyệt báo cáo này?',
      'reject' => 'Từ chối báo cáo này?',
      'cancel' => 'Hủy báo cáo này? Hành động không thể hoàn tác.',
      _ => 'Xác nhận?',
    };
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xác nhận'),
        content: Text(text),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Đóng'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Xác nhận'),
          ),
        ],
      ),
    );
    return ok ?? false;
  }

  void _openEdit() {
    final row = _row;
    Navigator.of(context).pop();
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
        child: _ReportForm(existing: row, onChanged: widget.onChanged),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final type = (_row['report_type'] ?? '').toString();
    final intern = _row['interns'] as Map<String, dynamic>?;
    final reviewer = _row['profiles'] as Map<String, dynamic>?;
    final content = _row['content'] is Map<String, dynamic>
        ? Map<String, dynamic>.from(_row['content'] as Map)
        : <String, dynamic>{};
    final fields = _fieldsByType[type] ?? const <_Field>[];
    final reviewable = _status == 'submitted' || _status == 'in_review';

    return SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  (_row['report_code'] ?? '').toString(),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              StatusPill(status: _status),
            ],
          ),
          const SizedBox(height: 8),
          Text(_typeLabels[type] ?? type),
          Text('Tiêu đề: ${(_row['title'] ?? '').toString()}'),
          Text(
            'Kỳ: ${fmtDbDate(_row['period_start'] as String?)}'
            '${_row['period_end'] != null && _row['period_end'] != _row['period_start'] ? ' → ${fmtDbDate(_row['period_end'] as String?)}' : ''}',
          ),
          if (_row['due_date'] != null)
            Text('Hạn nộp: ${fmtDbDate(_row['due_date'] as String?)}'),
          if (_row['is_late'] == true) const Text('Nộp muộn'),
          if (intern != null) Text('Thực tập sinh: ${(intern['full_name'] ?? '').toString()}'),
          Text('Nộp lúc: ${fmtDateTime(_row['submitted_at'] as String?)}'),
          if (reviewer != null)
            Text('Người duyệt: ${(reviewer['full_name'] ?? '').toString()}'),
          if (_row['reviewed_at'] != null)
            Text('Phê duyệt lúc: ${fmtDateTime(_row['reviewed_at'] as String?)}'),
          if (_row['rejection_reason'] != null)
            Text(
              'Từ chối: ${_row['rejection_reason']}',
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          if (_row['revision_note'] != null)
            Text('Cần chỉnh sửa: ${_row['revision_note']}'),
          if (_row['review_comment'] != null)
            Text('Nhận xét: ${_row['review_comment']}'),
          const Divider(height: 24),
          Text('Nội dung', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          if (content.isEmpty)
            Text(
              'Chưa có nội dung.',
              style: Theme.of(context).textTheme.bodySmall,
            )
          else
            ...fields.where((f) {
              final v = content[f.key];
              return v != null && v.toString().trim().isNotEmpty;
            }).map(
              (f) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      f.label,
                      style: Theme.of(context)
                          .textTheme
                          .labelSmall
                          ?.copyWith(fontWeight: FontWeight.w600),
                    ),
                    Text(content[f.key].toString()),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 12),
          TextField(
            controller: _comment,
            maxLines: 2,
            decoration: const InputDecoration(
              labelText: 'Nhận xét / lý do',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          if (widget.approveMode) ...[
            if (reviewable)
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  FilledButton(
                    onPressed:
                        _busy ? null : () => _action('approve', confirm: true),
                    child: const Text('Phê duyệt'),
                  ),
                  OutlinedButton(
                    onPressed: _busy
                        ? null
                        : () => _action('request_revision', requireComment: true),
                    child: const Text('Yêu cầu chỉnh sửa'),
                  ),
                  OutlinedButton(
                    onPressed: _busy
                        ? null
                        : () => _action('reject',
                            requireComment: true, confirm: true),
                    child: const Text('Từ chối'),
                  ),
                  if (_status == 'submitted')
                    OutlinedButton(
                      onPressed: _busy ? null : () => _action('take'),
                      child: const Text('Tiếp nhận'),
                    ),
                ],
              )
            else
              Text(
                'Báo cáo không ở trạng thái chờ xét duyệt.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
          ] else ...[
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (_canEdit) ...[
                  FilledButton(
                    onPressed: _busy ? null : () => _action('submit', confirm: true),
                    child: const Text('Nộp báo cáo'),
                  ),
                  OutlinedButton(
                    onPressed: _busy ? null : _openEdit,
                    child: const Text('Chỉnh sửa'),
                  ),
                ],
                if (_status != 'draft' &&
                    _status != 'approved' &&
                    _status != 'rejected' &&
                    _status != 'cancelled')
                  OutlinedButton(
                    onPressed:
                        _busy ? null : () => _action('cancel', confirm: true),
                    child: const Text('Hủy báo cáo'),
                  ),
                if (!_canEdit &&
                    (_status == 'approved' || _status == 'rejected'))
                  Text(
                    'Báo cáo đã được xử lý — không thể thay đổi.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
              ],
            ),
            if (_status == 'draft')
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  'Bản nháp — chưa được tính là đã nộp.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
          ],
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
