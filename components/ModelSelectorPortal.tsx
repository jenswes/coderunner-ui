"use client";

import React from "react";
import { createPortal } from "react-dom";
import ModelSelector from "@/components/ModelSelector";

/**
 * Mounts ModelSelector into the existing chat header/toolbar
 * and exposes header + composer heights as CSS variables:
 *   --chat-header-height
 *   --chat-composer-height
 */
export default function ModelSelectorPortal() {
  const [target, setTarget] = React.useState<Element | null>(null);

  // Find header/toolbar to inject into
  React.useEffect(() => {
    let alive = true;

    const findTarget = () => {
      const candidates = [
        '[data-sidebar-inset] header',
        'main header',
        '[role="toolbar"]',
        '[data-aui-toolbar]',
        '.aui-toolbar',
        '.chat-header',
        '.app-header',
      ];
      for (const sel of candidates) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      return null;
    };

    const tick = () => {
      if (!alive) return;
      const el = findTarget();
      if (el) setTarget(el);
    };

    // try now and for a short time in case header mounts later
    tick();
    const i1 = setInterval(tick, 250);
    const t1 = setTimeout(() => clearInterval(i1), 3000);

    return () => {
      alive = false;
      clearInterval(i1);
      clearTimeout(t1);
    };
  }, []);

  // HEADER: write --chat-header-height
  React.useEffect(() => {
    if (!target) return;
    const root = document.documentElement;

    const apply = () => {
      const h = Math.ceil((target as HTMLElement).getBoundingClientRect().height);
      root.style.setProperty("--chat-header-height", `${h}px`);
    };
    apply();

    const ro = new ResizeObserver(apply);
    ro.observe(target);

    const mo = new MutationObserver(apply);
    mo.observe(target, { attributes: true, childList: true, subtree: true });

    window.addEventListener("resize", apply);

    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [target]);

  // COMPOSER: find sticky bottom composer and write --chat-composer-height
  React.useEffect(() => {
    const root = document.documentElement;
    let composer: HTMLElement | null = null;
    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;

    const findComposer = (): HTMLElement | null => {
      // Prefer composer inside chat viewport if present
      const withinViewport = document.querySelector(
        ".chat-viewport .sticky.bottom-0"
      ) as HTMLElement | null;
      if (withinViewport) return withinViewport;

      // Fallback: any sticky bottom-0 (may exist w/o chat-viewport wrapper)
      const anySticky = document.querySelector(
        ".sticky.bottom-0"
      ) as HTMLElement | null;
      if (anySticky) return anySticky;

      // Last resort: locate textarea and bubble up to closest sticky container
      const ta = document.querySelector(
        'form textarea[name="input"]'
      ) as HTMLTextAreaElement | null;
      if (ta) {
        const sticky = ta.closest(".sticky") as HTMLElement | null;
        if (sticky) return sticky;
      }
      return null;
    };

    const apply = () => {
      const h = composer ? Math.ceil(composer.getBoundingClientRect().height) : 0;
      root.style.setProperty("--chat-composer-height", `${h}px`);
    };

    const hook = () => {
      composer = findComposer();
      apply();

      // Observe size and DOM changes of composer
      if (composer) {
        ro = new ResizeObserver(apply);
        ro.observe(composer);

        mo = new MutationObserver(apply);
        mo.observe(composer, { attributes: true, childList: true, subtree: true });
      }
    };

    // initial hook + light retries (composer often mounts later)
    hook();
    const i1 = setInterval(() => {
      if (!composer) hook();
    }, 250);
    const t1 = setTimeout(() => clearInterval(i1), 3000);

    window.addEventListener("resize", apply);

    return () => {
      clearInterval(i1);
      clearTimeout(t1);
      window.removeEventListener("resize", apply);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, []);

  if (!target) return null;

  return createPortal(
    <div className="ml-auto flex items-center gap-3">
      <ModelSelector />
    </div>,
    target
  );
}
