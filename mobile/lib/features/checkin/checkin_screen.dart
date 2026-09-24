import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/supabase.dart';
import '../../shared/empty_view.dart';
import '../../shared/error_view.dart';
import '../../shared/format.dart';

/// Chấm công dựa trên GPS (Edge Function `check-in` tự xác thực phạm vi).
class CheckinScreen extends StatefulWidget {
  const CheckinScreen({super.key});

  @override
  State<CheckinScreen> createState() => _CheckinScreenState();
}

class _CheckinScreenState extends State<CheckinScreen> {
  List<Map<String, dynamic>> _records = [];
  bool _busy = false;
  String? _error;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loadError = null);
    try {
      final data = await SupabaseService.instance
          .from('attendance')
          .select('check_in_at, check_out_at, status, work_date')
          .order('work_date', ascending: false)
          .limit(7);
      if (mounted) {
        setState(() => _records = List<Map<String, dynamic>>.from(data));
      }
    } catch (e) {
      if (mounted) setState(() => _loadError = e.toString());
    }
  }

  Future<void> _checkIn() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      final res = await SupabaseService.instance.functions.invoke(
        'check-in',
        body: {
          'lat': position.latitude,
          'lng': position.longitude,
        },
      );
      final map = (res.data as Map?)?.cast<String, dynamic>() ?? {};
      if (map['error'] != null) {
        throw StateError(map['error'].toString());
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Chấm công ${map['status'] ?? 'thành công'}')),
      );
      await _load();
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Chấm công')),
      body: _loadError != null
          ? ErrorView(message: _loadError!, onRetry: _load)
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                FilledButton.icon(
                  onPressed: _busy ? null : _checkIn,
                  icon: _busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.fingerprint),
                  label: Text(_busy ? 'Đang xác định vị trí...' : 'Chấm công hôm nay'),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    style: TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ],
                const SizedBox(height: 16),
                ..._records.isEmpty
                    ? [const EmptyView(icon: Icons.history, message: 'Chưa có bản ghi chấm công.')]
                    : _records.map(
                        (r) => Card(
                          child: ListTile(
                            leading: Icon(
                              r['status'] == 'present' ? Icons.check_circle : Icons.schedule,
                              color: r['status'] == 'present' ? Colors.green : Colors.orange,
                            ),
                            title: Text(fmtDbDate(r['work_date'] as String?)),
                            subtitle: Text(
                              'Vào: ${fmtTime(r['check_in_at'] as String?)} · Ra: ${fmtTime(r['check_out_at'] as String?)}',
                            ),
                          ),
                        ),
                      ),
              ],
            ),
    );
  }
}