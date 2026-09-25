import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/supabase.dart';
import '../../shared/empty_view.dart';
import '../../shared/error_view.dart';
import '../../shared/format.dart';

/// Điểm danh GPS — gửi tọa độ + độ chính xác tới Edge Function
/// `attendance-check`, backend tự xác minh bán kính / khung giờ và
/// quyết định kết quả. Giao diện chỉ hiển thị trạng thái backend trả về.
class CheckinScreen extends StatefulWidget {
  const CheckinScreen({super.key});

  @override
  State<CheckinScreen> createState() => _CheckinScreenState();
}

class _CheckinScreenState extends State<CheckinScreen> {
  static const _msgGpsOff = 'Vui lòng bật GPS để thực hiện điểm danh.';
  static const _msgPermission = 'Vui lòng cấp quyền truy cập vị trí.';
  static const _msgNoPosition = 'Không thể xác định vị trí hiện tại. Vui lòng thử lại.';
  static const _msgAccuracy = 'Độ chính xác GPS chưa đạt yêu cầu.';
  static const _msgOutOfZone = 'Bạn đang ở ngoài khu vực điểm danh cho phép.';
  static const _msgNoLocation = 'Bạn chưa được gán địa điểm làm việc.';

  List<Map<String, dynamic>> _records = [];
  Map<String, dynamic>? _location;
  Position? _position;

  bool _serviceEnabled = false;
  LocationPermission _permission = LocationPermission.denied;
  bool _locating = false;
  bool _busy = false;
  bool _mockLocation = false;

  String? _error;
  String? _success;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    unawaited(_refresh());
  }

  // ---------------------------------------------------------------------
  // GPS state
  // ---------------------------------------------------------------------
  Future<void> _refresh({bool requestPermission = true}) async {
    setState(() {
      _error = null;
      _loadError = null;
    });
    await Future.wait([
      _checkGps(requestPermission: requestPermission),
      _loadLocation(),
      _loadRecords(),
    ]);
    if (_serviceEnabled &&
        (_permission == LocationPermission.always ||
            _permission == LocationPermission.whileInUse)) {
      await _getLocation();
    }
  }

  Future<void> _checkGps({bool requestPermission = true}) async {
    final enabled = await Geolocator.isLocationServiceEnabled();
    var permission = await Geolocator.checkPermission();
    if (requestPermission &&
        (permission == LocationPermission.denied ||
            permission == LocationPermission.deniedForever)) {
      permission = await Geolocator.requestPermission();
    }
    if (!mounted) return;
    setState(() {
      _serviceEnabled = enabled;
      _permission = permission;
    });
  }

  Future<void> _getLocation() async {
    if (!_serviceEnabled) return;
    if (_permission != LocationPermission.whileInUse &&
        _permission != LocationPermission.always) {
      return;
    }
    setState(() {
      _locating = true;
      _error = null;
    });
    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 20),
        ),
      );
      if (!mounted) return;
      setState(() {
        _position = position;
        _mockLocation = position.isMocked;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = _msgNoPosition);
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  // ---------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------
  Future<void> _loadLocation() async {
    try {
      final data = await SupabaseService.instance
          .from('attendance_locations')
          .select('*')
          .eq('is_active', true)
          .order('created_at')
          .limit(1);
      if (!mounted) return;
      setState(() {
        _location = data.isEmpty ? null : Map<String, dynamic>.from(data.first as Map);
      });
    } catch (e) {
      if (mounted) setState(() => _loadError = e.toString());
    }
  }

  Future<void> _loadRecords() async {
    try {
      final data = await SupabaseService.instance
          .from('attendance')
          .select(
              'work_date, check_in_at, check_out_at, status, total_working_minutes, location_id')
          .order('work_date', ascending: false)
          .limit(14);
      if (!mounted) return;
      setState(() => _records = List<Map<String, dynamic>>.from(data));
    } catch (e) {
      if (mounted) setState(() => _loadError = e.toString());
    }
  }

  Map<String, dynamic>? get _today {
    final today = DateTime.now();
    final todayStr =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
    for (final r in _records) {
      if (r['work_date'] == todayStr) return r;
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // Geo helpers
  // ---------------------------------------------------------------------
  double? _distanceMeters() {
    final loc = _location;
    final pos = _position;
    if (loc == null || pos == null) return null;
    final lat1 = (loc['latitude'] as num).toDouble();
    final lon1 = (loc['longitude'] as num).toDouble();
    const r = 6371000.0;
    double rad(double d) => d * math.pi / 180;
    final dLat = rad(pos.latitude - lat1);
    final dLon = rad(pos.longitude - lon1);
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(rad(lat1)) *
            math.cos(rad(pos.latitude)) *
            math.sin(dLon / 2) *
            math.sin(dLon / 2);
    return 2 * r * math.asin(math.sqrt(a));
  }

  double? get _accuracyMeters => _position?.accuracy;

  bool get _hasLocation => _location != null;

  bool get _inZone {
    final dist = _distanceMeters();
    final radius = (_location?['radius_meters'] ?? _location?['radius_m'] as num?) as num?;
    if (dist == null || radius == null) return false;
    return dist <= radius.toDouble();
  }

  double? get _maxAccuracy => (_location?['min_accuracy_meters'] as num?)?.toDouble();

  bool get _gpsReady =>
      _serviceEnabled &&
      (_permission == LocationPermission.whileInUse ||
          _permission == LocationPermission.always);

  bool get _accuracyOk {
    final acc = _accuracyMeters;
    final max = _maxAccuracy;
    if (acc == null) return false;
    if (max == null) return true;
    return acc <= max;
  }

  bool get _canCheckIn =>
      _gpsReady &&
      _locating == false &&
      _position != null &&
      _hasLocation &&
      _inZone &&
      _accuracyOk &&
      !_mockLocation &&
      _today?['check_in_at'] == null;

  bool get _canCheckOut =>
      _gpsReady &&
      _locating == false &&
      _position != null &&
      _hasLocation &&
      _inZone &&
      _accuracyOk &&
      !_mockLocation &&
      _today?['check_in_at'] != null &&
      _today?['check_out_at'] == null;

  // ---------------------------------------------------------------------
  // Gửi điểm danh — backend tự xác minh, client chỉ hiển thị kết quả
  // ---------------------------------------------------------------------
  Future<void> _send(String action) async {
    setState(() {
      _busy = true;
      _error = null;
      _success = null;
    });

    try {
      if (!_serviceEnabled) throw StateError(_msgGpsOff);
      if (_permission != LocationPermission.whileInUse &&
          _permission != LocationPermission.always) {
        throw StateError(_msgPermission);
      }

      final position = _position ??
          await Geolocator.getCurrentPosition(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.high,
              timeLimit: Duration(seconds: 20),
            ),
          );
      setState(() => _position = position);

      final res = await SupabaseService.instance.functions.invoke(
        'attendance-check',
        body: {
          'action': action,
          'latitude': position.latitude,
          'longitude': position.longitude,
          'accuracy': position.accuracy,
        },
      );

      final map = (res.data as Map?)?.cast<String, dynamic>() ?? {};
      if (map['success'] == true) {
        final status = map['status']?.toString();
        final labels = {
          'present': 'Có mặt',
          'late': 'Đi muộn',
          'early_leave': 'Về sớm',
        };
        if (!mounted) return;
        setState(() {
          _success = map['message']?.toString() ??
              '${action == 'CHECK_IN' ? 'Check-in' : 'Check-out'} thành công'
                  '${status != null ? ' (${labels[status] ?? status})' : ''}';
        });
        await _loadRecords();
        return;
      }
      throw StateError(
          (map['error'] as Map?)?['message']?.toString() ?? 'Điểm danh bị từ chối.');
    } on FunctionException catch (e) {
      String message = 'Không thể xác minh vị trí. Vui lòng thử lại.';
      try {
        final body = jsonDecode(e.details.toString());
        final err = (body is Map ? body['error'] : null) as Map?;
        if (err?['message'] != null) message = err!['message'].toString();
      } catch (_) {
        if (e.details != null && e.details.toString().isNotEmpty) {
          message = e.details.toString();
        }
      }
      if (mounted) setState(() => _error = message);
    } catch (e) {
      final msg = e is StateError ? e.message.toString() : e.toString();
      if (mounted) setState(() => _error = msg);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  // ---------------------------------------------------------------------
  // UI helpers
  // ---------------------------------------------------------------------
  String get _zoneLabel {
    if (!_serviceEnabled) return 'GPS đang tắt';
    if (_permission == LocationPermission.denied ||
        _permission == LocationPermission.deniedForever) {
      return 'Chưa cấp quyền vị trí';
    }
    if (_locating) return 'Đang xác định vị trí...';
    if (!_hasLocation) return _msgNoLocation;
    if (_position == null) return _msgNoPosition;
    if (_mockLocation) return 'Vị trí mô phỏng (mock GPS) không được chấp nhận';
    if (!_accuracyOk) return _msgAccuracy;
    if (!_inZone) return _msgOutOfZone;
    return 'Trong khu vực điểm danh';
  }

  Color get _zoneColor {
    if (!_serviceEnabled ||
        _permission == LocationPermission.denied ||
        _permission == LocationPermission.deniedForever) {
      return Colors.orange;
    }
    if (_locating) return Colors.blueGrey;
    if (!_hasLocation || !_inZone || !_accuracyOk || _mockLocation) {
      return Colors.redAccent;
    }
    return Colors.green;
  }

  IconData get _zoneIcon {
    if (!_serviceEnabled) return Icons.gps_off;
    if (_permission == LocationPermission.denied ||
        _permission == LocationPermission.deniedForever) {
      return Icons.location_disabled;
    }
    if (_locating) return Icons.hourglass_top;
    if (!_hasLocation || !_inZone || !_accuracyOk || _mockLocation) {
      return Icons.location_off;
    }
    return Icons.location_on;
  }

  @override
  Widget build(BuildContext context) {
    if (_loadError != null && _location == null && _records.isEmpty) {
      return ErrorView(message: _loadError!, onRetry: _refresh);
    }

    final loc = _location;
    final today = _today;
    final dist = _distanceMeters();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Điểm danh'),
        actions: [
          IconButton(
            tooltip: 'Làm mới vị trí',
            onPressed: _locating ? null : () => _refresh(),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ---------------- Địa điểm được gán ----------------
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: loc == null
                    ? Text(_msgNoLocation,
                        style: TextStyle(color: Theme.of(context).colorScheme.error))
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.business, size: 18),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  loc['name']?.toString() ?? 'Địa điểm làm việc',
                                  style: Theme.of(context).textTheme.titleMedium,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          if (loc['address'] != null)
                            Text(loc['address'].toString(),
                                style: Theme.of(context).textTheme.bodySmall),
                          const SizedBox(height: 8),
                          Text(
                            'Bán kính: ${loc['radius_meters'] ?? loc['radius_m']} m'
                            '${loc['check_in_start_time'] != null ? ' · Check-in từ ${loc['check_in_start_time']}' : ''}'
                            '${loc['check_out_start_time'] != null ? ' · Check-out từ ${loc['check_out_start_time']}' : ''}',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
              ),
            ),
            const SizedBox(height: 12),

            // ---------------- Trạng thái GPS / khu vực ----------------
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(_zoneIcon, color: _zoneColor, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _zoneLabel,
                            style: TextStyle(
                              color: _zoneColor,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    if (_position != null)
                      Text(
                        'Vị trí: ${_position!.latitude.toStringAsFixed(5)}, '
                        '${_position!.longitude.toStringAsFixed(5)}'
                        '${dist != null ? ' · cách địa điểm ${dist.toStringAsFixed(0)} m' : ''}'
                        ' · độ chính xác ±${_position!.accuracy.toStringAsFixed(0)} m',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    if (!_serviceEnabled)
                      TextButton.icon(
                        onPressed: () => Geolocator.openLocationSettings(),
                        icon: const Icon(Icons.settings, size: 16),
                        label: const Text('Mở cài đặt GPS'),
                      ),
                    if (_serviceEnabled &&
                        (_permission == LocationPermission.denied ||
                            _permission == LocationPermission.deniedForever))
                      TextButton.icon(
                        onPressed: () => _refresh(requestPermission: true),
                        icon: const Icon(Icons.my_location, size: 16),
                        label: const Text('Cấp quyền vị trí'),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            // ---------------- Hôm nay ----------------
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Hôm nay', style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: _TimeTile(
                            label: 'Giờ vào',
                            value: fmtTime(today?['check_in_at'] as String?),
                            done: today?['check_in_at'] != null,
                          ),
                        ),
                        Expanded(
                          child: _TimeTile(
                            label: 'Giờ ra',
                            value: fmtTime(today?['check_out_at'] as String?),
                            done: today?['check_out_at'] != null,
                          ),
                        ),
                        Expanded(
                          child: _TimeTile(
                            label: 'Tổng cộng',
                            value: today?['total_working_minutes'] != null
                                ? '${today!['total_working_minutes']} phút'
                                : '—',
                            done: today?['total_working_minutes'] != null,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // ---------------- Nút thao tác ----------------
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: (!_canCheckIn || _busy) ? null : () => _send('CHECK_IN'),
                            icon: _busy
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  )
                                : const Icon(Icons.login),
                            label: const Text('Check-in'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: (!_canCheckOut || _busy) ? null : () => _send('CHECK_OUT'),
                            icon: const Icon(Icons.logout),
                            label: const Text('Check-out'),
                          ),
                        ),
                      ],
                    ),
                    if (_position != null && !_locating)
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton.icon(
                          onPressed: () => _getLocation(),
                          icon: const Icon(Icons.my_location, size: 16),
                          label: const Text('Cập nhật vị trí'),
                        ),
                      ),
                  ],
                ),
              ),
            ),

            if (_success != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.green.shade300),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.check_circle, color: Colors.green, size: 18),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_success!)),
                  ],
                ),
              ),
            ],

            if (_error != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.errorContainer,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, size: 18),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_error!)),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 20),
            Text('Lịch sử điểm danh', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 8),
            ..._records.isEmpty
                ? [
                    const EmptyView(
                      icon: Icons.history,
                      message: 'Chưa có bản ghi chấm công.',
                    ),
                  ]
                : _records.map((r) {
                    final status = r['status']?.toString();
                    final icon = status == 'present'
                        ? Icons.check_circle
                        : status == 'late'
                            ? Icons.schedule
                            : Icons.event;
                    final color = status == 'present'
                        ? Colors.green
                        : status == 'late'
                            ? Colors.orange
                            : Colors.blueGrey;
                    return Card(
                      child: ListTile(
                        dense: true,
                        leading: Icon(icon, color: color),
                        title: Text(fmtDbDate(r['work_date'] as String?)),
                        subtitle: Text(
                          'Vào: ${fmtTime(r['check_in_at'] as String?)}'
                          ' · Ra: ${fmtTime(r['check_out_at'] as String?)}'
                          '${r['total_working_minutes'] != null ? ' · ${r['total_working_minutes']} phút' : ''}',
                        ),
                      ),
                    );
                  }),
          ],
        ),
      ),
    );
  }
}

class _TimeTile extends StatelessWidget {
  const _TimeTile({required this.label, required this.value, required this.done});

  final String label;
  final String value;
  final bool done;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: done ? Theme.of(context).colorScheme.primary : null,
          ),
        ),
      ],
    );
  }
}
