const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const introDuration = prefersReducedMotion ? 100 : 2400;

window.setTimeout(() => {
  window.location.replace("/signin");
}, introDuration);
