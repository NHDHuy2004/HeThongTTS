import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/supabase.dart';
import '../../shared/empty_view.dart';
import '../../shared/error_view.dart';
import '../../shared/format.dart';
import '../../shared/status_pill.dart';

const _typeLabels = <String, String>{
  'leave': 'Nghỉ phép',
  'wfh': 'Làm từ xa',
  'late': 'Đi muộn',
  'early_leave': 'Về sớm',
  'attendance_adjustment': 'Điều chỉnh chấm công',
  'schedule_change': 'Thay đổi lịch làm',
  'other': 'Đơn khác',
};

const _requestSelect =
    '*, interns(full_name, student_code), profiles!requests_reviewer_id_fkey(full_name)';

class RequestsScreen extends StatefulWidget {
  const RequestsScreen({super.key, this.approveMode = false});

  final bool approveMode;

  @override
  State<RequestsScreen> createState() => _RequestsScreenState();
}

class _RequestsScreenState extends State<RequestsScreen> {
  List<Map<String, dynamic>> _requests = [];
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
          .from('requests')
          .select(_requestSelect)
          .order('submitted_at', ascending: false)
          .limit(100);
      if (!mounted) return;
      setState(() {
        _requests = rows.map((r) => Map<String, dynamic>.from(r)).toList();
      });
    } catch (e) {
      if (!mounted) return;
      final msg = e.toString();
      setState(() {
        _error = msg.contains('Could not find the table')
            ? 'Chưa chạy migration 0017_requests_management.sql — hãy chạy trong Supabase Dashboard.'
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
        child: _RequestForm(onChanged: _load),
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
        child: _RequestDetail(
          row: row,
          approveMode: widget.approveMode,
          onChanged: () {
            _load();
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.approveMode ? 'Duyệt đơn' : 'Đơn từ'),
      ),
      floatingActionButton: widget.approveMode
          ? null
          : FloatingActionButton.extended(
              onPressed: _openCreate,
              icon: const Icon(Icons.add),
              label: const Text('Tạo đơn'),
            ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : _requests.isEmpty
                  ? const EmptyView(
                      icon: Icons.request_page,
                      message: 'Chưa có đơn nào.',
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView(
                        padding: const EdgeInsets.only(bottom: 88),
                        children: _requests.map(_card).toList(),
                      ),
                    ),
    );
  }

  Widget _card(Map<String, dynamic> row) {
    final type = (row['request_type'] ?? '').toString();
    final status = (row['status'] ?? 'pending').toString();
    final internName =
        (row['interns'] as Map<String, dynamic>?)?['full_name'] as String?;

    final startDate = row['start_date'] as String?;
    final endDate = row['end_date'] as String?;
    String period;
    if (startDate == null) {
      period = '—';
    } else if (endDate == null || endDate == startDate) {
      period = fmtDbDate(startDate);
    } else {
      period = '${fmtDbDate(startDate)} → ${fmtDbDate(endDate)}';
    }

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
                '${(row['request_code'] ?? '').toString()} · '
                '${_typeLabels[type] ?? type}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              Text(period),
              if (internName != null) Text('Thực tập sinh: $internName'),
              Text('Lý do: ${(row['reason'] ?? '').toString()}'),
              if (row['rejection_reason'] != null)
                Text(
                  'Từ chối: ${row['rejection_reason']}',
                  style: TextStyle(
                      color: Theme.of(context).colorScheme.error),
                ),
              if (row['revision_note'] != null)
                Text('Cần bổ sung: ${row['revision_note']}'),
            ],
          ),
        ),
      ),
    );
  }
}

class _RequestForm extends StatefulWidget {
  const _RequestForm({required this.onChanged});

  final VoidCallback onChanged;

  @override
  State<_RequestForm> createState() => _RequestFormState();
}

class _RequestFormState extends State<_RequestForm> {
  final _title = TextEditingController();
  final _reason = TextEditingController();
  String _kind = 'leave';
  DateTime _start = DateTime.now();
  DateTime _end = DateTime.now();
  TimeOfDay _startTime = const TimeOfDay(hour: 9, minute: 0);
  TimeOfDay _endTime = const TimeOfDay(hour: 17, minute: 0);
  bool _busy = false;

  static final _dayFmt = DateFormat('dd/MM/yyyy');

  @override
  void dispose() {
    _title.dispose();
    _reason.dispose();
    super.dispose();
  }

  bool get _rangeMode => _kind == 'leave' || _kind == 'schedule_change';
  bool get _noDate => _kind == 'other';

  String _fmtDay(DateTime d) => _dayFmt.format(d);
  String _fmtDate(DateTime d) => d.toIso8601String().split('T').first;

  String _fmtTime(TimeOfDay t) =>
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

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

  Future<void> _pickTime({required bool isStart}) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: isStart ? _startTime : _endTime,
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startTime = picked;
        } else {
          _endTime = picked;
        }
      });
    }
  }

  Future<void> _submit() async {
    final title = _title.text.trim();
    final reason = _reason.text.trim();
    if (title.length < 3) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tiêu đề đơn phải có ít nhất 3 ký tự.')),
      );
      return;
    }
    if (reason.length < 5) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng nhập lý do (tối thiểu 5 ký tự).')),
      );
      return;
    }

    setState(() => _busy = true);
    try {
      Map<String, dynamic> payload = {};
      if (_kind == 'attendance_adjustment') {
        payload = {
          'proposed_check_in':
              '${_fmtDate(_start)}T${_fmtTime(_startTime)}:00+07:00',
          'proposed_check_out':
              '${_fmtDate(_start)}T${_fmtTime(_endTime)}:00+07:00',
        };
      }

      final result = await SupabaseService.instance.rpc<Map<String, dynamic>>(
        'create_request',
        params: {
          'p_request_type': _kind,
          'p_title': title,
          'p_reason': reason,
          'p_start_date': _noDate ? null : _fmtDate(_start),
          'p_end_date': _rangeMode ? _fmtDate(_end) : null,
          'p_start_time':
              _kind == 'late' ? '${_fmtTime(_startTime)}:00' : null,
          'p_end_time':
              _kind == 'early_leave' ? '${_fmtTime(_endTime)}:00' : null,
          'p_payload': payload,
          'p_description': null,
          'p_attachment_paths': <dynamic>[],
        },
      );

      if (result['success'] != true) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content:
                  Text((result['message'] ?? 'Không thể tạo đơn').toString()),
            ),
          );
        }
        return;
      }

      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text((result['message'] ?? 'Đã gửi đơn').toString()),
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

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Tạo đơn', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _typeLabels.entries
                .map(
                  (e) => ChoiceChip(
                    label: Text(e.value),
                    selected: _kind == e.key,
                    onSelected: (_) => setState(() => _kind = e.key),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _title,
            decoration: const InputDecoration(
              labelText: 'Tiêu đề *',
              border: OutlineInputBorder(),
            ),
          ),
          if (!_noDate) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.event),
                    label: Text(
                        '${_rangeMode ? 'Từ' : 'Ngày'}: ${_fmtDay(_start)}'),
                    onPressed: () => _pickDate(isStart: true),
                  ),
                ),
                if (_rangeMode) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.event),
                      label: Text('Đến: ${_fmtDay(_end)}'),
                      onPressed: () => _pickDate(isStart: false),
                    ),
                  ),
                ],
              ],
            ),
          ],
          if (_kind == 'late' || _kind == 'early_leave') ...[
            const SizedBox(height: 12),
            OutlinedButton.icon(
              icon: const Icon(Icons.schedule),
              label: Text(
                _kind == 'late'
                    ? 'Giờ đến dự kiến: ${_fmtTime(_startTime)}'
                    : 'Giờ về dự kiến: ${_fmtTime(_endTime)}',
              ),
              onPressed: () =>
                  _pickTime(isStart: _kind == 'late'),
            ),
          ],
          if (_kind == 'attendance_adjustment') ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.schedule),
                    label: Text('Vào: ${_fmtTime(_startTime)}'),
                    onPressed: () => _pickTime(isStart: true),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.schedule),
                    label: Text('Ra: ${_fmtTime(_endTime)}'),
                    onPressed: () => _pickTime(isStart: false),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 12),
          TextField(
            controller: _reason,
            maxLines: 2,
            decoration: const InputDecoration(
              labelText: 'Lý do *',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _busy ? null : _submit,
              child: Text(_busy ? 'Đang gửi...' : 'Gửi đơn'),
            ),
          ),
        ],
      ),
    );
  }
}

class _RequestDetail extends StatefulWidget {
  const _RequestDetail({
    required this.row,
    required this.approveMode,
    required this.onChanged,
  });

  final Map<String, dynamic> row;
  final bool approveMode;
  final VoidCallback onChanged;

  @override
  State<_RequestDetail> createState() => _RequestDetailState();
}

class _RequestDetailState extends State<_RequestDetail> {
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

  String get _status => (_row['status'] ?? 'pending').toString();

  Future<void> _review(String action, {bool requireComment = false}) async {
    final comment = _comment.text.trim();
    if (requireComment && comment.length < 5) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Vui lòng nhập lý do (tối thiểu 5 ký tự).')),
      );
      return;
    }
    if ((action == 'approve' || action == 'cancel') &&
        !(await _confirm(action))) {
      return;
    }

    setState(() => _busy = true);
    try {
      final result = await SupabaseService.instance.rpc<Map<String, dynamic>>(
        'review_request',
        params: {
          'p_request_id': _row['id'],
          'p_action': action,
          'p_comment': comment.isEmpty ? null : comment,
        },
      );
      if (!mounted) return;
      if (result['success'] != true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content:
                Text((result['message'] ?? 'Không thể xử lý đơn').toString()),
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
    final text = action == 'approve'
        ? 'Phê duyệt đơn này? Attendance sẽ được cập nhật tương ứng.'
        : 'Hủy đơn này? Hành động không thể hoàn tác.';
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

  @override
  Widget build(BuildContext context) {
    final type = (_row['request_type'] ?? '').toString();
    final intern = _row['interns'] as Map<String, dynamic>?;
    final reviewer = _row['profiles'] as Map<String, dynamic>?;
    final reviewable = _status == 'pending' || _status == 'in_review';
    final canCancel = _status == 'pending' ||
        _status == 'in_review' ||
        _status == 'needs_revision';
    final canResubmit = _status == 'needs_revision';

    return SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  (_row['request_code'] ?? '').toString(),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              StatusPill(status: _status),
            ],
          ),
          const SizedBox(height: 8),
          Text(_typeLabels[type] ?? type),
          const SizedBox(height: 8),
          Text('Tiêu đề: ${(_row['title'] ?? '').toString()}'),
          Text(
            'Thời gian: ${fmtDbDate(_row['start_date'] as String?)}'
            '${_row['end_date'] != null && _row['end_date'] != _row['start_date'] ? ' → ${fmtDbDate(_row['end_date'] as String?)}' : ''}',
          ),
          if (intern != null)
            Text('Thực tập sinh: ${(intern['full_name'] ?? '').toString()}'),
          Text('Lý do: ${(_row['reason'] ?? '').toString()}'),
          if (_row['description'] != null)
            Text('Mô tả: ${_row['description']}'),
          Text('Nộp lúc: ${fmtDateTime(_row['submitted_at'] as String?)}'),
          if (reviewer != null)
            Text('Người xét duyệt: ${(reviewer['full_name'] ?? '').toString()}'),
          if (_row['reviewed_at'] != null)
            Text('Duyệt lúc: ${fmtDateTime(_row['reviewed_at'] as String?)}'),
          if (_row['rejection_reason'] != null)
            Text('Lý do từ chối: ${_row['rejection_reason']}'),
          if (_row['revision_note'] != null)
            Text('Cần bổ sung: ${_row['revision_note']}'),
          if (_row['review_comment'] != null)
            Text('Ghi chú duyệt: ${_row['review_comment']}'),
          const SizedBox(height: 12),
          TextField(
            controller: _comment,
            maxLines: 2,
            decoration: const InputDecoration(
              labelText: 'Lý do / nội dung bổ sung',
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
                    onPressed: _busy
                        ? null
                        : () => _review('approve'),
                    child: const Text('Duyệt'),
                  ),
                  OutlinedButton(
                    onPressed: _busy
                        ? null
                        : () => _review('reject', requireComment: true),
                    child: const Text('Từ chối'),
                  ),
                  OutlinedButton(
                    onPressed: _busy
                        ? null
                        : () =>
                            _review('request_revision', requireComment: true),
                    child: const Text('Yêu cầu bổ sung'),
                  ),
                  if (_status == 'pending')
                    OutlinedButton(
                      onPressed: _busy ? null : () => _review('take'),
                      child: const Text('Tiếp nhận'),
                    ),
                ],
              )
            else
              Text(
                'Đơn đã được xử lý — không thể thay đổi nữa.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
          ] else ...[
            if (canResubmit || canCancel)
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (canResubmit)
                    FilledButton(
                      onPressed: _busy ? null : () => _review('resubmit'),
                      child: const Text('Gửi lại đơn'),
                    ),
                  if (canCancel)
                    OutlinedButton(
                      onPressed: _busy ? null : () => _review('cancel'),
                      child: const Text('Hủy đơn'),
                    ),
                ],
              )
            else
              Text(
                'Đơn đã hoàn tất xử lý — bạn không thể thay đổi.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
          ],
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
