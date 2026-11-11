import React, { useRef } from "react";
export default function Tabs({ id, label, tabs, value, onChange }) {
  const root = useRef(null);
  return (
    <div
      ref={root}
      className="workspace-tabs"
      role="tablist"
      aria-label={label}
      onKeyDown={(e) => {
        const index = tabs.findIndex((t) => t[0] === value);
        let next;
        if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
        if (e.key === "ArrowLeft")
          next = (index - 1 + tabs.length) % tabs.length;
        if (e.key === "Home") next = 0;
        if (e.key === "End") next = tabs.length - 1;
        if (next !== undefined) {
          e.preventDefault();
          onChange(tabs[next][0]);
          root.current.querySelectorAll('[role="tab"]')[next].focus();
        }
      }}
    >
      {tabs.map(([key, text, count]) => (
        <button
          key={key}
          id={`${id}-tab-${key}`}
          role="tab"
          aria-selected={value === key}
          aria-controls={`${id}-panel-${key}`}
          tabIndex={value === key ? 0 : -1}
          onClick={() => onChange(key)}
        >
          {text}
          {count !== undefined && <span className="tab-count">{count}</span>}
        </button>
      ))}
    </div>
  );
}
