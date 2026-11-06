"use client";
import { useRef, useState } from "react";
import { shellCopy as copy } from "@/domain/copy";
import { ThemeToggle } from "./ThemeToggle";
export function HeaderMenu() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  return (
    <div
      className="header-menu"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <button
        ref={toggle}
        type="button"
        className="button menu-toggle"
        aria-label={copy.menu}
        aria-expanded={open}
        aria-controls="header-navigation"
        onClick={() => {
          setOpen(!open);
        }}
      >
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
        >
          <path d="M3 5h14M3 10h14M3 15h14" />
        </svg>
      </button>
      <nav
        id="header-navigation"
        className={`header-navigation ${open ? "is-open" : ""}`}
      >
        <a href="/how-it-works">{copy.how}</a>
        <a href="https://github.com/firatkill/bidlock" rel="noopener">
          {copy.github}
        </a>
        <ThemeToggle />
      </nav>
    </div>
  );
}
