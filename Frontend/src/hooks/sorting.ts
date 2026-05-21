export function sortData<T>(
  data: T[],
  column: string | null,
  direction: "asc" | "desc" | null
): T[] {
  if (!column || !direction) return data;

  return [...data].sort((a, b) => {
    const aValue = a[column as keyof T];
    const bValue = b[column as keyof T];

    if (aValue === bValue) return 0;

    const comparison = aValue < bValue ? -1 : 1;
    return direction === "asc" ? comparison : -comparison;
  });
}
