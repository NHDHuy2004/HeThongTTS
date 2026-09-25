"use client";

import { Progress, ProgressLabel, ProgressTrack } from "@/components/ui/progress";

export function OnboardingProgress({ value, className }: { value: number; className?: string }) {
  const normalized = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <Progress value={normalized} className={className}>
      <ProgressLabel className="sr-only">Tiến độ onboarding</ProgressLabel>
      <ProgressTrack />
      <span className="text-xs font-semibold tabular-nums text-muted-foreground">
        {normalized}%
      </span>
    </Progress>
  );
}
