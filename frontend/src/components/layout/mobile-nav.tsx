"use client";

import { Sidebar } from "@/components/layout/sidebar";

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNav({
  open,
  onClose,
}: MobileNavProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-label="Close navigation"
      />

      <div className="relative h-full w-72 max-w-[85vw] animate-[slideIn_180ms_ease-out]">
        <Sidebar mobile onNavigate={onClose} />
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }

          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}