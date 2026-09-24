import 'package:intl/intl.dart';

final _dayFmt = DateFormat('dd/MM/yyyy');

String fmtDbDate(String? value) {
  if (value == null) return '—';
  final d = DateTime.tryParse(value);
  return d == null ? value : _dayFmt.format(d);
}

String fmtTime(String? iso) {
  if (iso == null) return '—';
  final d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return iso;
  final h = d.hour.toString().padLeft(2, '0');
  final m = d.minute.toString().padLeft(2, '0');
  return '$h:$m';
}