"use client";
import { FileUp, ArrowUpRight } from "lucide-react";
export function FilePicker({
  label,
  accept,
  filename,
  hint,
  disabled = false,
  onSelect,
}: {
  label: string;
  accept: string;
  filename?: string;
  hint: string;
  disabled?: boolean;
  onSelect: (file: File | null) => void;
}) {
  return (
    <label className="file-picker" aria-disabled={disabled}>
      <span className="file-picker-symbol">
        <FileUp size={21} />
      </span>
      <span className="file-picker-description">
        <strong>{label}</strong>
        <small>{filename || hint}</small>
      </span>
      <span className="file-picker-action">
        Selecionar
        <ArrowUpRight size={14} aria-hidden="true" />
      </span>
      <input
        className="sr-only"
        aria-label={label}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(e) => onSelect(e.target.files?.[0] || null)}
      />
    </label>
  );
}
