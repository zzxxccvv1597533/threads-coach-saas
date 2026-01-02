import { useState, useCallback, useMemo } from 'react';

export interface UseMultiSelectOptions<T> {
  items: T[];
  getItemId: (item: T) => string | number;
}

export interface UseMultiSelectReturn<T> {
  selectedIds: Set<string | number>;
  selectedItems: T[];
  isSelected: (id: string | number) => boolean;
  toggle: (id: string | number) => void;
  selectAll: () => void;
  deselectAll: () => void;
  toggleAll: () => void;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  selectedCount: number;
}

export function useMultiSelect<T>({
  items,
  getItemId,
}: UseMultiSelectOptions<T>): UseMultiSelectReturn<T> {
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  const isSelected = useCallback(
    (id: string | number) => selectedIds.has(id),
    [selectedIds]
  );

  const toggle = useCallback((id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allIds = items.map(getItemId);
    setSelectedIds(new Set(allIds));
  }, [items, getItemId]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isAllSelected = useMemo(() => {
    if (items.length === 0) return false;
    return items.every((item) => selectedIds.has(getItemId(item)));
  }, [items, selectedIds, getItemId]);

  const isSomeSelected = useMemo(() => {
    return selectedIds.size > 0 && !isAllSelected;
  }, [selectedIds, isAllSelected]);

  const toggleAll = useCallback(() => {
    if (isAllSelected) {
      deselectAll();
    } else {
      selectAll();
    }
  }, [isAllSelected, selectAll, deselectAll]);

  const selectedItems = useMemo(() => {
    return items.filter((item) => selectedIds.has(getItemId(item)));
  }, [items, selectedIds, getItemId]);

  const selectedCount = selectedIds.size;

  return {
    selectedIds,
    selectedItems,
    isSelected,
    toggle,
    selectAll,
    deselectAll,
    toggleAll,
    isAllSelected,
    isSomeSelected,
    selectedCount,
  };
}
