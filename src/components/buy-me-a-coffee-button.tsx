"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    bmcBtnWidget?: (
      text: string,
      slug: string,
      color: string,
      emoji: string,
      font?: string,
      fontColor?: string,
      outlineColor?: string,
      coffeeColor?: string,
    ) => string;
  }
}

const BMC_SCRIPT_SRC = "https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js";

const BMC_CONFIG = {
  text: "Buy me a coffee",
  slug: "ludylops",
  color: "#5F7FFF",
  emoji: "",
  font: "Poppins",
  fontColor: "#ffffff",
  outlineColor: "#000000",
  coffeeColor: "#FFDD00",
} as const;

const BMC_FOOTER_STYLES = `
  .bmc-footer-button .bmc-btn {
    min-width: unset !important;
    height: 2.5rem !important;
    padding: 0 0.625rem !important;
    font-size: 0.75rem !important;
    line-height: 1 !important;
    border-radius: 0 !important;
  }

  .bmc-footer-button .bmc-btn svg {
    height: 1.125rem !important;
    width: auto !important;
    transform: none !important;
  }

  .bmc-footer-button .bmc-btn-text {
    margin-left: 0.375rem !important;
  }
`;

function renderButton(container: HTMLDivElement) {
  const widget = window.bmcBtnWidget;
  if (!widget) return false;

  container.innerHTML = widget(
    BMC_CONFIG.text,
    BMC_CONFIG.slug,
    BMC_CONFIG.color,
    BMC_CONFIG.emoji,
    BMC_CONFIG.font,
    BMC_CONFIG.fontColor,
    BMC_CONFIG.outlineColor,
    BMC_CONFIG.coffeeColor,
  );
  return true;
}

function loadBmcScript(): Promise<void> {
  if (window.bmcBtnWidget) {
    return Promise.resolve();
  }

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${BMC_SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      if (window.bmcBtnWidget) {
        resolve();
        return;
      }

      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("BMC script failed")), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = BMC_SCRIPT_SRC;
    script.async = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("BMC script failed")), { once: true });
    document.head.appendChild(script);
  });
}

export function BuyMeACoffeeButton() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    void loadBmcScript()
      .then(() => {
        if (!cancelled && containerRef.current) {
          renderButton(containerRef.current);
        }
      })
      .catch(() => {
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = `<a class="bmc-btn" target="_blank" rel="noopener noreferrer" href="https://buymeacoffee.com/${BMC_CONFIG.slug}" style="display:inline-flex;align-items:center;height:2.5rem;padding:0 0.625rem;background:${BMC_CONFIG.color};color:${BMC_CONFIG.fontColor};font-family:Poppins,sans-serif;font-size:0.75rem;font-weight:700;text-decoration:none;">${BMC_CONFIG.text}</a>`;
        }
      });

    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, []);

  return (
    <div className="bmc-footer-button flex items-center">
      <style dangerouslySetInnerHTML={{ __html: BMC_FOOTER_STYLES }} />
      <div ref={containerRef} className="flex items-center" />
    </div>
  );
}
