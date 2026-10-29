"use client";

import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

/**
 * Hook thay thế `window.confirm`.
 *
 * const [confirm, confirmDialog] = useConfirm();
 * ...
 * if (!(await confirm({ title: "..." }))) return;
 * ...
 * return <>{...}{confirmDialog}</>;
 */
export function useConfirm() {
  const [state, setState] = React.useState<ConfirmState | null>(null);

  const confirm = React.useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ ...options, resolve });
      }),
    [],
  );

  function handleOpenChange(open: boolean) {
    if (!open) {
      setState((current) => {
        current?.resolve(false);
        return null;
      });
    }
  }

  function handleConfirm() {
    setState((current) => {
      current?.resolve(true);
      return null;
    });
  }

  const dialog = state ? (
    <AlertDialog open onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.title}</AlertDialogTitle>
          {state.description ? (
            <AlertDialogDescription>{state.description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{state.cancelLabel ?? "Hủy"}</AlertDialogCancel>
          <AlertDialogAction
            variant={state.destructive ? "destructive" : "default"}
            onClick={handleConfirm}
          >
            {state.confirmLabel ?? "Xác nhận"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;

  return [confirm, dialog] as const;
}

export type PromptOptions = {
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  minLength?: number;
};

type PromptState = PromptOptions & {
  resolve: (value: string | null) => void;
};

/**
 * Hook thay thế `window.prompt` — trả về chuỗi đã trim, hoặc `null` nếu hủy.
 */
export function usePrompt() {
  const [state, setState] = React.useState<PromptState | null>(null);
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const prompt = React.useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setValue("");
        setError(null);
        setState({ ...options, resolve });
      }),
    [],
  );

  function handleOpenChange(open: boolean) {
    if (!open) {
      setState((current) => {
        current?.resolve(null);
        return null;
      });
    }
  }

  function submit() {
    if (!state) return;
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Vui lòng nhập nội dung.");
      return;
    }
    if (state.minLength && trimmed.length < state.minLength) {
      setError(`Vui lòng nhập tối thiểu ${state.minLength} ký tự.`);
      return;
    }
    setState((current) => {
      current?.resolve(trimmed);
      return null;
    });
  }

  const dialog = state ? (
    <AlertDialog open onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.title}</AlertDialogTitle>
          {state.description ? (
            <AlertDialogDescription>{state.description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          {state.label ? <Label>{state.label}</Label> : null}
          <Textarea
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            placeholder={state.placeholder}
            rows={3}
            autoFocus
          />
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Hủy</AlertDialogCancel>
          <Button onClick={submit}>{state.confirmLabel ?? "Xác nhận"}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;

  return [prompt, dialog] as const;
}
