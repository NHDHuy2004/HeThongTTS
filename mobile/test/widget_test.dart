import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Skeleton smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: Text('Hệ thống Thực tập')),
    );
    expect(find.text('Hệ thống Thực tập'), findsOneWidget);
  });
}