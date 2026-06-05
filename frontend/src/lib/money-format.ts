export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value);
}
