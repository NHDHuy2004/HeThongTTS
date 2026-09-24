import 'package:flutter/material.dart';

import '../checkin/checkin_screen.dart';
import '../reports/reports_screen.dart';
import 'profile_screen.dart';

/// Shell chính theo vai trò (intern / mentor / admin / hr).
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.role});

  final String role;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final isIntern = widget.role == 'intern';
    final isStaff = widget.role == 'admin' || widget.role == 'hr' || widget.role == 'mentor';

    final pages = <Widget>[];

    if (isIntern) {
      pages.add(const CheckinScreen());
      pages.add(const ReportsScreen());
    } else if (isStaff) {
      pages.add(const ReportsScreen(approveMode: true));
    }

    pages.add(ProfileScreen(role: widget.role));

    final items = <BottomNavigationBarItem>[];
    if (isIntern) items.add(const BottomNavigationBarItem(icon: Icon(Icons.place), label: 'Chấm công'));
    if (isStaff) items.add(const BottomNavigationBarItem(icon: Icon(Icons.fact_check), label: 'Duyệt báo cáo'));
    if (isIntern) items.add(const BottomNavigationBarItem(icon: Icon(Icons.description), label: 'Báo cáo'));
    items.add(const BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Hồ sơ'));

    // Đảm bảo index không vượt quá số tab.
    final safeIndex = _index.clamp(0, pages.length - 1);

    return Scaffold(
      body: IndexedStack(index: safeIndex, children: pages),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: safeIndex,
        onTap: (i) => setState(() => _index = i),
        items: items,
      ),
    );
  }
}