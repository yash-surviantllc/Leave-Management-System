type QueryStateProps = {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  loadingLabel: string;
  errorLabel: string;
  emptyLabel: string;
};

export function QueryState({
  isLoading,
  isError,
  isEmpty,
  loadingLabel,
  errorLabel,
  emptyLabel
}: QueryStateProps) {
  if (isLoading) {
    return (
      <div className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-slate-500">
        {loadingLabel}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
        {errorLabel}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  return null;
}
