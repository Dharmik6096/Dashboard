import React, { useState, useRef, useMemo } from "react";
import { PortalPopover } from "./PortalPopover";
import { Search } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface SearchableComboboxProps {
  value: string;
  options: Option[];
  onChange: (val: string) => void;
  placeholder?: string;
  width?: number | string;
  allowAdd?: boolean;
  onAdd?: (val: string) => void;
  label?: string;
}

export function SearchableCombobox({
  value,
  options,
  onChange,
  placeholder = "Select...",
  width = 200,
  allowAdd = false,
  onAdd,
  label
}: SearchableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);

  const displayValue = options.find((o) => o.value === value)?.label || value || placeholder;

  const sortedOptions = useMemo(() => {
    const selected = options.find(o => o.value === value);
    const rest = options.filter(o => o.value !== value);
    return selected ? [selected, ...rest] : options;
  }, [options, value]);

  const allFilteredOptions = useMemo(() => {
    if (!search) return sortedOptions;
    const q = search.toLowerCase();
    return sortedOptions.filter(o => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [sortedOptions, search]);

  const filteredOptions = allFilteredOptions.slice(0, 5);
  const hasMore = allFilteredOptions.length > 5;
  const exactMatch = filteredOptions.some(o => o.value.toLowerCase() === search.trim().toLowerCase());

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {label && <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>{label}</span>}
      <button
        type="button"
        ref={buttonRef}
        className="input"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width,
          textAlign: "left",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          height: 32,
          padding: "0 12px",
          background: "var(--bg-hover)",
          border: "1px solid var(--border)",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {displayValue}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>

      <PortalPopover
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        anchorEl={buttonRef.current}
        width={width}
      >
        <div style={{ padding: "4px" }}>
          <div style={{ position: "relative", marginBottom: "4px" }}>
            <Search size={12} style={{ position: "absolute", left: 8, top: 8, color: "var(--text-muted)" }} />
            <input
              type="text"
              autoFocus
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
              style={{ width: "100%", height: 28, padding: "0 8px 0 24px", fontSize: 13, background: "var(--bg-input)" }}
            />
          </div>
          <div style={{ maxHeight: 250, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {filteredOptions.length === 0 && (!allowAdd || search.trim() === "") && (
              <div style={{ padding: "8px 12px", fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
                No options found
              </div>
            )}
            {filteredOptions.map((opt) => (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                  setSearch("");
                }}
                style={{
                  padding: "6px 12px",
                  fontSize: 13,
                  cursor: "pointer",
                  borderRadius: 4,
                  background: value === opt.value ? "var(--bg-active)" : "transparent",
                  color: "var(--text-primary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = value === opt.value ? "var(--bg-active)" : "transparent")}
              >
                {opt.label}
              </div>
            ))}
            
            {hasMore && (
              <div style={{ padding: "6px 12px", fontSize: 12, color: "var(--text-muted)", textAlign: "center", fontStyle: "italic", borderTop: "1px solid var(--border-subtle)", marginTop: 4 }}>
                More results available — continue typing
              </div>
            )}
            
            {allowAdd && search.trim() !== "" && !exactMatch && (
              <div
                onClick={() => {
                  if (onAdd) onAdd(search.trim());
                  setIsOpen(false);
                  setSearch("");
                }}
                style={{
                  padding: "6px 12px",
                  fontSize: 13,
                  cursor: "pointer",
                  borderRadius: 4,
                  borderTop: filteredOptions.length > 0 ? "1px solid var(--border-subtle)" : "none",
                  marginTop: filteredOptions.length > 0 ? 4 : 0,
                  color: "var(--color-blue)",
                  fontWeight: 500
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                + Create "{search.trim()}"
              </div>
            )}
            {allowAdd && search.trim() === "" && filteredOptions.length > 0 && (
              <div
                onClick={() => {}}
                style={{
                  padding: "6px 12px",
                  fontSize: 13,
                  cursor: "default",
                  borderRadius: 4,
                  borderTop: "1px solid var(--border-subtle)",
                  marginTop: 4,
                  color: "var(--text-muted)",
                }}
              >
                Type to add new...
              </div>
            )}
          </div>
        </div>
      </PortalPopover>
    </div>
  );
}
