import { useState, useMemo } from "react";

// Helper to extract flat or nested values
const extractValue = (item, key) => {
  const flat = item[key];
  if (flat !== undefined && flat !== null) {
    return typeof flat === "object"
      ? flat.valueString || flat.content || JSON.stringify(flat)
      : flat;
  }

  const nested = item.extractedData?.[key];
  if (nested !== undefined && nested !== null) {
    return typeof nested === "object"
      ? nested.valueString || nested.content || JSON.stringify(nested)
      : nested;
  }

  return "";
};

const compareValues = (a, b, direction) => {
  const emptyA = a === null || a === undefined || a === "";
  const emptyB = b === null || b === undefined || b === "";

  if (emptyA && !emptyB) return 1;
  if (!emptyA && emptyB) return -1;
  if (emptyA && emptyB) return 0;

  const aNum = parseFloat(a);
  const bNum = parseFloat(b);
  const isNumber = !isNaN(aNum) && !isNaN(bNum);

  if (isNumber) {
    return direction === "ascending" ? aNum - bNum : bNum - aNum;
  } else {
    const aStr = a.toString().toLowerCase();
    const bStr = b.toString().toLowerCase();
    if (aStr < bStr) return direction === "ascending" ? -1 : 1;
    if (aStr > bStr) return direction === "ascending" ? 1 : -1;
    return 0;
  }
};

const useSortableData = (items, config = null) => {
  const [sortConfig, setSortConfig] = useState(config);

  const sortedData = useMemo(() => {
    if (!items) return [];

    let sortableItems = [...items];

    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aVal = extractValue(a, sortConfig.key);
        const bVal = extractValue(b, sortConfig.key);
        return compareValues(aVal, bVal, sortConfig.direction);
      });
    }

    return sortableItems;
  }, [items, sortConfig]);

  const toggleSort = (key) => {
    if (!sortConfig || sortConfig.key !== key) {
      setSortConfig({ key, direction: "ascending" }); // 1st click
    } else if (sortConfig.direction === "ascending") {
      setSortConfig({ key, direction: "descending" }); // 2nd click
    } else if (sortConfig.direction === "descending") {
      setSortConfig(null); // 3rd click (reset)
    }
  };

  const renderSortIcon = (key) => {
    if (!sortConfig || sortConfig.key !== key) return "↕";
    if (sortConfig.direction === "ascending") return "↑";
    if (sortConfig.direction === "descending") return "↓";
    return "↕";
  };

  return {
    sortedData,
    toggleSort,
    renderSortIcon,
    sortColumn: sortConfig?.key,
    sortOrder: sortConfig?.direction,
  };
};

export default useSortableData;
