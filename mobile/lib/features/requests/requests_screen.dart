import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/current_user.dart';
import '../../core/fcm.dart';
import '../../core/supabase.dart';
import '../../shared/empty_view.dart';
import '../../shared/error_view.dart';
import '../../shared/format.dart';
import '../../shared/status_pill.dart';

class RequestsScreen extends StatefulWidget {
  const RequestsScreen({super.key, this.approveMode = false});

  final bool approveMode;

  @override
  State<RequestsScreen> createState() => _RequestsScreenState();
}

class _RequestsScreenState extends State<RequestsScreen> {
  static const kinds = [
    ('leave', 'Nghỉ phép'),
    ('wfh', 'Làm từ xa'),
    ('late', 'Đi muộn'),
    ('early_leave', 'Về sớm'),
  ];

  List<_Req> _requests = [];
  bool _loading = true;
  String? _error;
  String? _internId;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    if (!widget.approveMode) _internId = await myInternId();
    await _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final supabase = SupabaseService.instance;
      final intern = _internId;
      final List<_Req> merged = [];

      Future<void> fetch(
        String table, {
        required bool useDates,
      }) async {
        var q = supabase.from(table).select('*');
        if (intern != null) q = q.eq('intern_id', intern);
        final rows = await q.order('created_at', ascending: false).limit(100);
        for (final row in rows) {
          merged.add(_Req(kind: table, row: row));
        }
      }

      await Future.wait([
        fetch('leave_requests', useDates: true),
        fetch('late_requests', useDates: false),
        fetch('work_from_home_requests', useDates: false),
      ]);

      merged.sort((a, b) {
        final ca = a.row['created_at'] ?? '';
        final cb = b.row['created_at'] ?? '';
        return cb.toString().compareTo(ca.toString());
      });

      if (mounted) setState(() => _requests = merged);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
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
        child: _RequestForm(onCreated: _load),
      ),
    );
  }

  Future<void> _cancel(String kind, String id) async {
    await SupabaseService.instance
        .from(kind)
        .update({'status': 'cancelled'}).eq('id', id);
    await _load();
  }

  Future<void> _review(_Req r, String status) async {
    final uid = SupabaseService.instance.auth.currentUser?.id;
    final id = r.row['id'] as String;
    await SupabaseService.instance.from(r.kind).update({
      'status': status,
      'reviewed_by': uid,
      'reviewed_at': DateTime.now().toIso8601String(),
    }).eq('id', id);
    unawaited(FcmService.notifyReview(
      internId: r.row['intern_id'] as String,
      type: status == 'approved' ? 'request_approved' : 'request_rejected',
      title: _titleOf(r),
      body: '${_titleOf(r)} ${status == 'approved' ? 'đã được duyệt.' : 'đã bị từ chối.'}',
      data: {
        'table': r.kind,
        'id': id,
        'notification_id': id,
      },
    ));
    await _load();
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
                        children: _requests.map((r) => _card(r)).toList(),
                      ),
                    ),
    );
  }

  String _titleOf(_Req r) {
    final type = (r.row['request_type'] ?? r.kind).toString();
    return {
      'leave_requests': 'Nghỉ phép',
      'work_from_home_requests': 'Làm từ xa',
      'late_requests': type == 'early_leave' ? 'Về sớm' : 'Đi muộn',
    }[r.kind]!;
  }

  Widget _card(_Req r) {
    final row = r.row;
    final title = _titleOf(r);

    final dateInfo = switch (r.kind) {
      'leave_requests' =>
        '${fmtDbDate(row['start_date'] as String?)} → ${fmtDbDate(row['end_date'] as String?)}',
      'work_from_home_requests' => fmtDbDate(row['work_date'] as String?),
      _ => '${fmtDbDate(row['request_date'] as String?)}'
          '${row['minutes_late'] != null ? ' · ${row['minutes_late']} phút' : ''}',
    };

    final status = row['status'] as String;
    final canCancel = !widget.approveMode && status == 'pending';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(title,
                      style: Theme.of(context).textTheme.titleMedium),
                ),
                StatusPill(status: status),
              ],
            ),
            const SizedBox(height: 4),
            Text(dateInfo),
            Text('Lý do: ${row['reason'] ?? ''}'),
            if (row['review_note'] != null)
              Text('Ghi chú: ${row['review_note']}'),
            const SizedBox(height: 8),
            if (canCancel)
              Row(
                children: [
                  TextButton(
                    onPressed: () => _cancel(r.kind, row['id'] as String),
                    child: const Text('Hủy đơn'),
                  ),
                ],
              ),
            if (widget.approveMode && status == 'pending')
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
        ),
      ),
    );
  }
}

class _Req {
  _Req({required this.kind, required this.row});

  final String kind;
  final Map<String, dynamic> row;
}

class _RequestForm extends StatefulWidget {
  const _RequestForm({required this.onCreated});

  final VoidCallback onCreated;

  @override
  State<_RequestForm> createState() => _RequestFormState();
}

class _RequestFormState extends State<_RequestForm> {
  final _reason = TextEditingController();
  String _kind = 'leave';
  DateTime _start = DateTime.now();
  DateTime _end = DateTime.now();
  int _minutes = 30;
  bool _busy = false;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final internId = await myInternId();
    if (internId == null || _reason.text.trim().isEmpty) return;

    final supabase = SupabaseService.instance;
    setState(() => _busy = true);
    try {
      switch (_kind) {
        case 'leave':
          await supabase.from('leave_requests').insert({
            'intern_id': internId,
            'start_date': _fmt(_start),
            'end_date': _fmt(_end),
            'reason': _reason.text.trim(),
          });
        case 'wfh':
          await supabase.from('work_from_home_requests').insert({
            'intern_id': internId,
            'work_date': _fmt(_start),
            'reason': _reason.text.trim(),
          });
        default:
          await supabase.from('late_requests').insert({
            'intern_id': internId,
            'request_type': _kind,
            'request_date': _fmt(_start),
            'minutes_late': _kind == 'late' ? _minutes : null,
            'reason': _reason.text.trim(),
          });
      }
      if (mounted) Navigator.of(context).pop();
      widget.onCreated();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _fmt(DateTime d) => d.toIso8601String().split('T').first;

  static final _dayFmt = DateFormat('dd/MM/yyyy');

  String _fmtDay(DateTime d) => _dayFmt.format(d);

  Future<void> _pickDate(BuildContext sheetContext, bool isStart, bool isEnd) async {
    final picked = await showDatePicker(
      context: sheetContext,
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

  @override
  Widget build(BuildContext context) {
    final singleDate = _kind != 'leave';

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Tạo đơn', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          children: _RequestsScreenState.kinds
              .map(
                (k) => ChoiceChip(
                  label: Text(k.$2),
                  selected: _kind == k.$1,
                  onSelected: (_) => setState(() => _kind = k.$1),
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                icon: const Icon(Icons.event),
                label: Text('Từ: ${_fmtDay(_start)}'),
                onPressed: () => _pickDate(context, true, false),
              ),
            ),
            if (!singleDate) ...[
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.event),
                  label: Text('Đến: ${_fmtDay(_end)}'),
                  onPressed: () => _pickDate(context, false, true),
                ),
              ),
            ],
          ],
        ),
        if (_kind == 'late') ...[
          const SizedBox(height: 12),
          Row(
            children: [
              Text('Số phút:  $_minutes'),
              Expanded(
                child: Slider(
                  min: 5,
                  max: 180,
                  divisions: 35,
                  label: '$_minutes',
                  value: _minutes.toDouble(),
                  onChanged: (v) => setState(() => _minutes = v.round()),
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
            labelText: 'Lý do',
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
    );
  }
}