"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

interface Option {
  value: string | number;
  label: string;
}

interface CustomSelectProps {
  label?: string;
  value: string | number;
  options: Option[];
  onChange: (value: string | number) => void;
  width?: number | string;
  className?: string;
}

export function CustomSelect({ label, value, options, onChange, width = "auto", className = "" }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => String(opt.value) === String(value)) || options[0];

  return (
    <div 
      ref={containerRef} 
      className={`custom-select-container ${className}`} 
      style={{ width, position: "relative" }}
    >
      <button
        type="button"
        className={`custom-select-trigger ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="custom-select-value">
          {label && <span className="custom-select-label">{label}: </span>}
          <span className="custom-select-selected-text">{selectedOption?.label}</span>
        </span>
        <ChevronDown size={14} className="custom-select-icon" />
      </button>

      {isOpen && (
        <div className="custom-select-dropdown fade-in-fast" role="listbox">
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <button
                key={opt.value}
                type="button"
                className={`custom-select-option ${isSelected ? "selected" : ""}`}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                role="option"
                aria-selected={isSelected}
              >
                <span className="custom-select-option-icon">
                  {isSelected && <Check size={12} />}
                </span>
                <span className="custom-select-option-label">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
