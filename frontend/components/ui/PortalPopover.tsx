import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";

interface PortalPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  children: React.ReactNode;
  width?: number | string;
  className?: string;
  offsetX?: number;
  offsetY?: number;
  placement?: "bottom" | "right";
}

export function PortalPopover({
  isOpen,
  onClose,
  anchorEl,
  children,
  width = 200,
  className = "",
  offsetX = 0,
  offsetY = 4,
  placement = "bottom",
}: PortalPopoverProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen && anchorEl) {
      const updatePosition = () => {
        const rect = anchorEl.getBoundingClientRect();
        let top, left;

        if (placement === "bottom") {
          top = rect.bottom + offsetY;
          left = rect.left + offsetX;
        } else {
          // right
          top = rect.top + offsetY;
          left = rect.right + offsetX;
        }

        if (popoverRef.current) {
          const popoverRect = popoverRef.current.getBoundingClientRect();
          if (placement === "bottom") {
            // Check bottom collision
            if (top + popoverRect.height > window.innerHeight) {
              top = rect.top - popoverRect.height - offsetY; // flip above
            }
          } else {
            // Check bottom collision
            if (top + popoverRect.height > window.innerHeight) {
              top = window.innerHeight - popoverRect.height - 8;
            }
          }
          // Check right collision
          if (left + popoverRect.width > window.innerWidth) {
            if (placement === "right") {
              left = rect.left - popoverRect.width - offsetX; // flip left
            } else {
              left = window.innerWidth - popoverRect.width - 8;
            }
          }
          // Check left collision
          if (left < 8) {
            left = 8;
          }
        }
        
        setPosition({ top, left });
      };

      updatePosition();
      
      // Update position on scroll/resize
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition, true);
      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition, true);
      };
    }
  }, [isOpen, anchorEl, offsetX, offsetY]);

  useEffect(() => {
    if (isOpen) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      const handleClickOutside = (e: MouseEvent) => {
        if (
          popoverRef.current &&
          !popoverRef.current.contains(e.target as Node) &&
          anchorEl &&
          !anchorEl.contains(e.target as Node)
        ) {
          onClose();
        }
      };

      document.addEventListener("keydown", handleEscape);
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("keydown", handleEscape);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen, onClose, anchorEl]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      ref={popoverRef}
      className={className}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        zIndex: 9999, // high controlled z-index
        width,
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        padding: 4,
        animation: "dropdownFadeIn 100ms ease",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <style>{`
        @keyframes dropdownFadeIn {
          from { opacity: 0; transform: translateY(3px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {children}
    </div>,
    document.body
  );
}
