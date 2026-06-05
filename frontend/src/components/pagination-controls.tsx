"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PaginationMeta } from "@/lib/api";

type PaginationControlsProps = {
  pagination: PaginationMeta | null;
  onPageChange: (page: number) => void;
  isFetching: boolean;
};

function getPaginationValues(pagination: PaginationMeta | null): {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
} | null {
  if (!pagination) {
    return null;
  }

  if (pagination.pagination) {
    return pagination.pagination;
  }

  if (
    typeof pagination.total !== "number" ||
    typeof pagination.page !== "number" ||
    typeof pagination.pageSize !== "number" ||
    typeof pagination.totalPages !== "number"
  ) {
    return null;
  }

  return {
    total: pagination.total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: pagination.totalPages
  };
}

export function PaginationControls({
  pagination,
  onPageChange,
  isFetching
}: PaginationControlsProps) {
  const values = getPaginationValues(pagination);

  if (!values || values.totalPages <= 1) {
    return null;
  }

  const start = (values.page - 1) * values.pageSize + 1;
  const end = Math.min(values.page * values.pageSize, values.total);

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <span>
        Showing {start}-{end} of {values.total}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <button
          className="grid h-9 w-9 place-items-center rounded-md border border-line text-slate-600 transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={() => onPageChange(values.page - 1)}
          disabled={isFetching || values.page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <span className="min-w-20 shrink-0 text-center text-xs font-medium text-slate-500">
          Page {values.page} of {values.totalPages}
        </span>
        <button
          className="grid h-9 w-9 place-items-center rounded-md border border-line text-slate-600 transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={() => onPageChange(values.page + 1)}
          disabled={isFetching || values.page >= values.totalPages}
          aria-label="Next page"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
