// Single source of truth for Plausible custom event names.
//
// Calling `track(...)` in any island is a noop when:
//   - PUBLIC_PLAUSIBLE_DOMAIN is not set (script not emitted in Base.astro)
//   - Plausible script is blocked by an extension
//   - Code runs server-side / during SSR
//
// All event names are stable string literals — rename here and grep across
// the codebase. The launch checklist verifies these against Plausible's
// dashboard pre-launch.

export const Events = {
  /** Fires once per session at first arrival on the result view via wizard
   *  submission. NEVER fires on permalink hydration. */
  CalculatorCompleted: "calculator_completed",
  /** Fires when the user clicks "Copiar link" and the clipboard write
   *  resolves successfully. Never fires on rejection. */
  PermalinkCopied: "permalink_copied",
  /** Fires when a hash payload decodes successfully on mount. */
  PermalinkLoaded: "permalink_loaded",
  /** Fires when a hash payload fails to decode (malformed, unknown version,
   *  validation failure). */
  PermalinkInvalid: "permalink_invalid",
} as const;

export type EventName = (typeof Events)[keyof typeof Events];

type EventProps = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: (event: string, opts?: { props?: EventProps }) => void;
  }
}

export function track(event: EventName, props?: EventProps): void {
  if (typeof window === "undefined") return;
  try {
    window.plausible?.(event, props ? { props } : undefined);
  } catch {
    // Plausible should never throw; if it does (extension interference,
    // CSP violation), the event is silently lost. Analytics is directional.
  }
}
