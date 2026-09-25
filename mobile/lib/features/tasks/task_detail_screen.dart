import 'package:flutter/material.dart';

import '../../core/fcm.dart';
import '../../core/supabase.dart';
import '../../shared/format.dart';
import '../../shared/status_pill.dart';

const _kStatuses = [
  ('not_started', 'Chưa làm'),
  ('in_progress', 'Đang làm'),
  ('in_review', 'Chờ duyệt'),
  ('changes_requested', 'Cần sửa'),
  ('completed', 'Hoàn thành'),
  ('cancelled', 'Đã hủy'),
];

/// Chi tiết task: trạng thái, sub-task, nộp bài (intern), đánh giá (staff).
class TaskDetailScreen extends StatefulWidget {
  const TaskDetailScreen({super.key, required this.taskId, required this.role});

  final String taskId;
  final String role;

  @override
  State<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends State<TaskDetailScreen> {
  Map<String, dynamic>? _task;
  List<Map<String, dynamic>> _subtasks = [];
  List<Map<String, dynamic>> _submissions = [];
  List<Map<String, dynamic>> _reviews = [];
  final Map<String, String> _names = {};
  bool _loading = true;
  bool _busy = false;
  String? _error;

  bool get isIntern => widget.role == 'intern';
  bool get isStaff => widget.role == 'admin' ||
      widget.role == 'hr' ||
      widget.role == 'mentor';

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
      final task = await supabase
          .from('tasks')
          .select(
            '*, internships(interns(full_name)), '
            'task_assignees(intern_id, role, interns(full_name))',
          )
          .eq('id', widget.taskId)
          .maybeSingle();
      if (task == null) throw Exception('Không tìm thấy task.');

      final subtasks = await supabase
          .from('task_subtasks')
          .select('*')
          .eq('task_id', widget.taskId)
          .order('created_at');
      final submissions = await supabase
          .from('task_submissions')
          .select('*, task_submission_files(*), task_submission_links(*)')
          .eq('task_id', widget.taskId)
          .order('submitted_at', ascending: false);
      final reviews = await supabase
          .from('task_reviews')
          .select('*')
          .eq('task_id', widget.taskId)
          .order('reviewed_at', ascending: false);

      final personIds = [
        for (final r in reviews) r['reviewer_id'] as String?,
        for (final s in submissions) s['submitted_by'] as String?,
      ].whereType<String>().toList();

      final names = personIds.isEmpty
          ? []
          : await supabase
              .from('profiles')
              .select('id, full_name')
              .inFilter('id', personIds);

      if (mounted) {
        setState(() {
          _task = task;
          _subtasks = List<Map<String, dynamic>>.of(subtasks);
          _submissions = List<Map<String, dynamic>>.of(submissions);
          _reviews = List<Map<String, dynamic>>.of(reviews);
          _names
            ..clear()
            ..addEntries(names.map((n) =>
                MapEntry(n['id'] as String, n['full_name'] as String? ?? '—')));
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _updateStatus(String status) async {
    final supabase = SupabaseService.instance;
    setState(() => _busy = true);
    try {
      await supabase.from('tasks').update({
        'status': status,
        'completed_at': status == 'completed'
            ? DateTime.now().toIso8601String()
            : null,
      }).eq('id', widget.taskId);
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _addSubtask() async {
    final title = TextEditingController();
    final desc = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Thêm sub-task'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: title,
              autofocus: true,
              decoration: const InputDecoration(labelText: 'Tiêu đề'),
            ),
            TextField(
              controller: desc,
              decoration: const InputDecoration(labelText: 'Mô tả'),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(title.text.trim()),
            child: const Text('Lưu'),
          ),
        ],
      ),
    );
    if (result == null || result.isEmpty) return;
    try {
      final supabase = SupabaseService.instance;
      await supabase.from('task_subtasks').insert({
        'task_id': widget.taskId,
        'title': result,
        'description': desc.text.trim().isEmpty ? null : desc.text.trim(),
        'status': 'not_started',
        'priority': 'medium',
      });
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  Future<void> _setSubtaskStatus(String id, String status) async {
    try {
      final supabase = SupabaseService.instance;
      await supabase
          .from('task_subtasks')
          .update({'status': status}).eq('id', id);
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  // --- Nộp bài (intern) ---
  Future<void> _submitTask() async {
    final summary = TextEditingController();
    final details = TextEditingController();
    final problems = TextEditingController();
    final solutions = TextEditingController();
    final notes = TextEditingController();
    final links = <TextEditingController>[];

    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          scrollable: true,
          title: const Text('Nộp bài'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: summary,
                decoration: const InputDecoration(
                  labelText: 'Tóm tắt công việc đã làm *',
                ),
                maxLines: 3,
              ),
              TextField(
                controller: details,
                decoration: const InputDecoration(labelText: 'Chi tiết triển khai'),
                maxLines: 3,
              ),
              TextField(
                controller: problems,
                decoration: const InputDecoration(labelText: 'Vấn đề gặp phải'),
                maxLines: 2,
              ),
              TextField(
                controller: solutions,
                decoration: const InputDecoration(labelText: 'Giải pháp'),
                maxLines: 2,
              ),
              TextField(
                controller: notes,
                decoration: const InputDecoration(labelText: 'Ghi chú'),
                maxLines: 2,
              ),
              const SizedBox(height: 8),
              for (final c in links) ...[
                TextField(
                  controller: c,
                  decoration: const InputDecoration(
                    labelText: 'Link sản phẩm (url)',
                  ),
                ),
                const SizedBox(height: 6),
              ],
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () => setDialogState(() => links.add(TextEditingController())),
                  icon: const Icon(Icons.add_link, size: 18),
                  label: const Text('Thêm link'),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Hủy'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Nộp'),
            ),
          ],
        ),
      ),
    );

    if (ok != true) return;
    if (!mounted) return;
    if (summary.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng nhập tóm tắt công việc.')),
      );
      return;
    }
    try {
      final supabase = SupabaseService.instance;
      final max = await supabase
          .from('task_submissions')
          .select('submission_no')
          .eq('task_id', widget.taskId)
          .order('submission_no', ascending: false)
          .limit(1)
          .maybeSingle();
      final no = (max?['submission_no'] as int? ?? 0) + 1;
      final userId = supabase.auth.currentUser?.id;

      final sub = await supabase.from('task_submissions').insert({
        'task_id': widget.taskId,
        'submitted_by': userId,
        'work_summary': summary.text.trim(),
        'implementation_details':
            details.text.trim().isEmpty ? null : details.text.trim(),
        'problems': problems.text.trim().isEmpty ? null : problems.text.trim(),
        'solutions': solutions.text.trim().isEmpty ? null : solutions.text.trim(),
        'notes': notes.text.trim().isEmpty ? null : notes.text.trim(),
        'submission_no': no,
      }).select('id').single();

      final validLinks = links
          .map((c) => c.text.trim())
          .where((u) => u.isNotEmpty)
          .toList();
      if (validLinks.isNotEmpty) {
        await supabase.from('task_submission_links').insert(
          validLinks.map((u) => {'submission_id': sub['id'], 'url': u}).toList(),
        );
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  // --- Đánh giá (staff) ---
  Future<void> _reviewTask() async {
    final decision = ValueNotifier<String>('approved');
    final completion = ValueNotifier<String>('complete');
    final deadline = ValueNotifier<String?>(null);
    final pct = TextEditingController();
    final quality = TextEditingController();
    final technical = TextEditingController();
    final documentation = TextEditingController();
    final soft = TextEditingController();
    final feedback = TextEditingController();

    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          scrollable: true,
          title: const Text('Đánh giá task'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: decision.value,
                decoration: const InputDecoration(labelText: 'Kết luận'),
                items: const [
                  DropdownMenuItem(value: 'approved', child: Text('Duyệt')),
                  DropdownMenuItem(
                      value: 'changes_requested', child: Text('Yêu cầu sửa')),
                  DropdownMenuItem(value: 'rejected', child: Text('Từ chối')),
                ],
                onChanged: (v) =>
                    setDialogState(() => decision.value = v ?? 'approved'),
              ),
              DropdownButtonFormField<String>(
                initialValue: completion.value,
                decoration: const InputDecoration(labelText: 'Mức độ hoàn thành'),
                items: const [
                  DropdownMenuItem(value: 'complete', child: Text('Hoàn thành')),
                  DropdownMenuItem(value: 'partial', child: Text('Một phần')),
                  DropdownMenuItem(value: 'none', child: Text('Chưa hoàn thành')),
                ],
                onChanged: (v) =>
                    setDialogState(() => completion.value = v ?? 'complete'),
              ),
              DropdownButtonFormField<String>(
                initialValue: deadline.value,
                decoration: const InputDecoration(labelText: 'Hạn bài'),
                items: const [
                  DropdownMenuItem(value: 'on_time', child: Text('Đúng hạn')),
                  DropdownMenuItem(value: 'late', child: Text('Trễ hạn')),
                ],
                onChanged: (v) => setDialogState(() => deadline.value = v),
              ),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: pct,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: '% hoàn thành'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: quality,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Chất lượng 1-5'),
                    ),
                  ),
                ],
              ),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: technical,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Kỹ thuật 1-5'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: documentation,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Tài liệu 1-5'),
                    ),
                  ),
                ],
              ),
              TextField(
                controller: soft,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Mềm dẻo 1-5'),
              ),
              TextField(
                controller: feedback,
                decoration: const InputDecoration(labelText: 'Nhận xét'),
                maxLines: 3,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Hủy'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Lưu'),
            ),
          ],
        ),
      ),
    );

    if (ok != true) return;
    try {
      final supabase = SupabaseService.instance;
      double? numv(TextEditingController c) =>
          double.tryParse(c.text.trim());
      await supabase.from('task_reviews').insert({
        'task_id': widget.taskId,
        'reviewer_id': supabase.auth.currentUser?.id,
        'decision': decision.value,
        'completion': completion.value,
        'deadline_bucket': deadline.value,
        'completion_pct': numv(pct),
        'quality_score': numv(quality),
        'technical_score': numv(technical),
        'documentation_score': numv(documentation),
        'soft_score': numv(soft),
        'feedback': feedback.text.trim().isEmpty ? null : feedback.text.trim(),
      });
      await _notifyAssigned(type: decision.value == 'approved'
          ? 'task_review_approved'
          : 'task_review_changes');
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  Future<void> _notifyAssigned({required String type}) async {
    final assignees =
        ((_task?['task_assignees'] as List?) ?? const []);
    for (final a in assignees) {
      final internId = (a as Map)['intern_id'] as String?;
      if (internId == null) continue;
      await FcmService.notifyReview(
        internId: internId,
        type: type,
        title: 'Công việc',
        body: 'Task "${_task?['title']}" đã được đánh giá.',
        data: {'table': 'tasks', 'id': widget.taskId},
      );
    }
  }

  // --- UI ---
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Chi tiết công việc')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _header(),
                      const SizedBox(height: 12),
                      _statusButtons(),
                      if (_task?['objective'] != null ||
                          _task?['requirements'] != null ||
                          _task?['acceptance_criteria'] != null)
                        _requirements(),
                      const Divider(),
                      _subtasksSection(),
                      const Divider(),
                      _submissionsSection(),
                      const Divider(),
                      _reviewsSection(),
                    ],
                  ),
                ),
    );
  }

  Widget _header() {
    final t = _task!;
    final members = ((t['task_assignees'] as List?) ?? const [])
        .map((a) => ((a as Map)['interns'] as Map?)?['full_name'] as String?)
        .whereType<String>()
        .toList()
        .join(', ');
    final deliverables = (t['deliverables'] as List?) ?? const [];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    t['title'] as String,
                    style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ),
                StatusPill(status: t['status'] as String? ?? 'not_started'),
              ],
            ),
            const SizedBox(height: 8),
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
            const SizedBox(height: 12),
            _kv('Dự án / Module',
                '${t['project'] ?? '—'} / ${t['module'] ?? '—'}'),
            _kv('Loại task', t['task_type'] as String?),
            _kv('Intern chính',
                ((t['internships'] as Map?)?['interns'] as Map?)?['full_name']
                    as String?),
            if (members.isNotEmpty) _kv('Thành viên', members),
            if (deliverables.isNotEmpty)
              _kv('Deliverable bắt buộc', deliverables.join(', ')),
          ],
        ),
      ),
    );
  }

  Widget _statusButtons() {
    final current = _task?['status'] as String? ?? 'not_started';
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final (value, label) in _kStatuses)
          if (value != current)
            ActionChip(
              label: Text(label),
              onPressed:
                  _busy || (isIntern && (value == 'completed' || value == 'cancelled'))
                      ? null
                      : () => _updateStatus(value),
            )
          else
            Chip(
              label: Text(label),
              backgroundColor: Theme.of(context).colorScheme.primaryContainer,
            ),
      ],
    );
  }

  Widget _requirements() {
    final t = _task!;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (t['objective'] != null)
              _kv('Mục tiêu', t['objective'] as String?),
            if (t['requirements'] != null)
              _kv('Yêu cầu chi tiết', t['requirements'] as String?),
            if (t['acceptance_criteria'] != null)
              _kv('Tiêu chí nghiệm thu', t['acceptance_criteria'] as String?),
          ],
        ),
      ),
    );
  }

  Widget _subtasksSection() {
    return _section(
      title: 'Sub-tasks (${_subtasks.length})',
      trailing: isStaff
          ? IconButton(
              onPressed: _addSubtask,
              icon: const Icon(Icons.add, size: 20),
            )
          : null,
      children: _subtasks.isEmpty
          ? [const Text('Chưa có sub-task.')]
          : _subtasks
              .map((st) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      st['status'] == 'completed'
                          ? Icons.check_circle
                          : Icons.radio_button_unchecked,
                      color: st['status'] == 'completed'
                          ? Colors.green
                          : Colors.grey,
                      size: 20,
                    ),
                    title: Text(st['title'] as String),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (st['description'] != null)
                          Text(st['description'] as String),
                        if (st['due_date'] != null)
                          Text('Hạn: ${fmtDateTime(st['due_date'] as String?)}'),
                      ],
                    ),
                    trailing: isStaff
                        ? DropdownButton<String>(
                            value: st['status'] as String?,
                            underline: const SizedBox.shrink(),
                            items: [
                              for (final (v, l) in _kStatuses)
                                DropdownMenuItem(value: v, child: Text(l)),
                            ],
                            onChanged: (v) {
                              if (v != null) {
                                _setSubtaskStatus(st['id'] as String, v);
                              }
                            },
                          )
                        : StatusPill(status: st['status'] as String? ?? ''),
                  ))
              .toList(),
    );
  }

  Widget _submissionsSection() {
    return _section(
      title: 'Nộp bài & lịch sử (${_submissions.length})',
      trailing: isIntern
          ? IconButton(
              onPressed: _submitTask,
              icon: const Icon(Icons.upload, size: 20),
            )
          : null,
      children: _submissions.isEmpty
          ? [
              const Text('Chưa có bài nộp.'),
              if (isIntern) const Text('Hãy nộp bài để được đánh giá.'),
            ]
          : _submissions.map((s) => _submissionCard(s)).toList(),
    );
  }

  Widget _submissionCard(Map<String, dynamic> s) {
    final files = ((s['task_submission_files'] as List?) ?? const []);
    final links = ((s['task_submission_links'] as List?) ?? const []);
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text(
            'Lần nộp #${s['submission_no']} · ${_names[s['submitted_by'] as String?] ?? '—'}'),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (s['work_summary'] != null) Text(s['work_summary'] as String),
            if (s['implementation_details'] != null)
              Text('Triển khai: ${s['implementation_details']}'),
            if (s['problems'] != null) Text('Vấn đề: ${s['problems']}'),
            if (s['solutions'] != null) Text('Giải pháp: ${s['solutions']}'),
            if (links.isNotEmpty)
              Wrap(
                spacing: 6,
                children: [
                  for (final l in links)
                    ActionChip(
                      label: Text((l as Map)['url'] as String),
                      onPressed: () {},
                    ),
                ],
              ),
            if (files.isNotEmpty)
              Text('File: ${files.map((f) => (f as Map)['file_name']).join(', ')}'),
            Text(fmtDateTime(s['submitted_at'] as String?),
                style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ],
        ),
      ),
    );
  }

  Widget _reviewsSection() {
    return _section(
      title: 'Đánh giá (${_reviews.length})',
      trailing: isStaff && (_submissions.isNotEmpty || _reviews.isEmpty)
          ? IconButton(
              onPressed: _reviewTask,
              icon: const Icon(Icons.rate_review_outlined, size: 20),
            )
          : null,
      children: _reviews.isEmpty
          ? [const Text('Chưa có đánh giá.')]
          : _reviews.map((r) => _reviewCard(r)).toList(),
    );
  }

  Widget _reviewCard(Map<String, dynamic> r) {
    final decision = r['decision'] as String? ?? '';
    final score = r['final_score'];
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: decision == 'approved'
            ? const Icon(Icons.check_circle, color: Colors.green)
            : decision == 'rejected'
                ? const Icon(Icons.cancel, color: Colors.red)
                : const Icon(Icons.rate_review, color: Colors.orange),
        title: Text(
            '${decision == 'approved' ? 'Duyệt' : decision == 'rejected' ? 'Từ chối' : 'Yêu cầu sửa'}'
            ' · ${_names[r['reviewer_id'] as String?] ?? '—'}'),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (r['completion_pct'] != null)
              Text('Hoàn thành ${r['completion_pct']}%'),
            if (r['quality_score'] != null)
              Text('Chất lượng ${r['quality_score']}/5 · Kỹ thuật ${r['technical_score']}/5 · '
                  'Tài liệu ${r['documentation_score']}/5 · Mềm dẻo ${r['soft_score']}/5'),
            if (r['feedback'] != null) Text(r['feedback'] as String),
            Row(
              children: [
                if (score != null)
                  Text('Điểm: $score/10',
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                const Spacer(),
                Text(fmtDateTime(r['reviewed_at'] as String?),
                    style: const TextStyle(fontSize: 11, color: Colors.grey)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _section({
    required String title,
    Widget? trailing,
    required List<Widget> children,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(title,
                  style: const TextStyle(
                      fontSize: 15, fontWeight: FontWeight.bold)),
            ),
            if (trailing != null) trailing,
          ],
        ),
        const SizedBox(height: 4),
        ...children,
      ],
    );
  }

  Widget _kv(String label, String? value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: RichText(
        text: TextSpan(
          style: DefaultTextStyle.of(context).style,
          children: [
            TextSpan(
              text: '$label: ',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            TextSpan(text: value ?? '—'),
          ],
        ),
      ),
    );
  }
}