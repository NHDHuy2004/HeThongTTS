import 'package:flutter/material.dart';

/// Ô skeleton nhấp nháy nhẹ — dùng thay `CircularProgressIndicator`
/// khi đang tải danh sách để giữ nguyên bố cục (không "nhảy" màn hình).
class SkeletonBox extends StatelessWidget {
  const SkeletonBox({
    super.key,
    this.width,
    this.height = 16,
    this.radius = 8,
  });

  final double? width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).colorScheme.surfaceContainerHighest;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.4, end: 0.9),
      duration: const Duration(milliseconds: 700),
      curve: Curves.easeInOut,
      builder: (context, opacity, child) =>
          Opacity(opacity: opacity, child: child),
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: base,
          borderRadius: BorderRadius.circular(radius),
        ),
      ),
    );
  }
}

/// Skeleton dạng "thẻ danh sách": avatar + 2 dòng chữ.
class SkeletonListTile extends StatelessWidget {
  const SkeletonListTile({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: const Row(
        children: [
          SkeletonBox(width: 44, height: 44, radius: 12),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBox(width: double.infinity, height: 14),
                SizedBox(height: 8),
                SkeletonBox(width: 160, height: 12),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Skeleton cho màn danh sách nói chung (dashboard/reports/requests/...).
class SkeletonListView extends StatelessWidget {
  const SkeletonListView({super.key, this.itemCount = 6});

  final int itemCount;

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      physics: const NeverScrollableScrollPhysics(),
      itemCount: itemCount,
      itemBuilder: (_, __) => const SkeletonListTile(),
    );
  }
}
