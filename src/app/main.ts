import Alpine from "alpinejs";
import collapse from "@alpinejs/collapse";

import "flatpickr/dist/flatpickr.min.css";
import "flatpickr/dist/themes/dark.css";
import "../styles/tailwind.css";

import { registerIcons } from "../icons";
import { dashboard, accentColors } from "./dashboard";

// Load saved accent color and inject CSS variables
let savedSettings: Record<string, unknown> = {};
try {
  savedSettings = JSON.parse(localStorage.getItem("github-dashboard") || "{}");
} catch {
  localStorage.removeItem("github-dashboard");
}
const currentAccent = accentColors[savedSettings.accentColor as keyof typeof accentColors] || accentColors.emerald;

const style = document.createElement("style");
style.textContent = `
  :root {
    --accent-400: ${currentAccent[400]};
    --accent-500: ${currentAccent[500]};
    --accent-600: ${currentAccent[600]};
    --accent-700: ${currentAccent[700]};
    --accent-900: ${currentAccent[900]};
  }
`;
document.head.appendChild(style);

// Chart tooltip functions (global for inline SVG event handlers)
declare global {
  interface Window {
    showChartTooltip: (event: MouseEvent, count: number, label: string) => void;
    hideChartTooltip: (event: MouseEvent) => void;
  }
}

window.showChartTooltip = function (event: MouseEvent, count: number, label: string) {
  const tooltip = document.getElementById("chartTooltip");
  if (!tooltip) return;

  const countEl = tooltip.querySelector(".chart-tooltip-count");
  const labelEl = tooltip.querySelector(".chart-tooltip-label");
  if (countEl) countEl.textContent = count.toLocaleString();
  if (labelEl) labelEl.textContent = label;

  const target = event.target as SVGElement;
  const rect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();

  let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
  let top = rect.top - tooltipRect.height - 10;

  if (left < 10) left = 10;
  if (left + tooltipRect.width > window.innerWidth - 10) {
    left = window.innerWidth - tooltipRect.width - 10;
  }
  if (top < 10) {
    top = rect.bottom + 10;
  }

  tooltip.style.left = left + "px";
  tooltip.style.top = top + "px";
  tooltip.classList.add("visible");

  target.setAttribute("r", "7");
  target.setAttribute("stroke-width", "3");
};

window.hideChartTooltip = function (event: MouseEvent) {
  const tooltip = document.getElementById("chartTooltip");
  if (tooltip) tooltip.classList.remove("visible");

  const target = event.target as SVGElement;
  target.setAttribute("r", "5");
  target.setAttribute("stroke-width", "2");
};

// Initialize Alpine
Alpine.plugin(collapse);
Alpine.data("dashboard", dashboard);

Alpine.start();

// Register service worker for PWA
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
