import { useState } from 'react';

const STORAGE_KEY = 'adminSidebarCollapsed';

export default function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  return [collapsed, toggleCollapsed];
}
