import defaultDarkThemeContent from "../themes/default-dark.css?raw";
import midnightThemeContent from "../themes/midnight.css?raw";
import paperThemeContent from "../themes/paper.css?raw";
import whitewallThemeContent from "../themes/whitewall.css?raw";

// ============================================================================
// Types and Constants
// ============================================================================

const BUILTIN_THEMES = [
  "system",
  "default",
  "default-dark",
  "midnight",
  "paper",
  "whitewall",
] as const;

type BuiltinTheme = (typeof BUILTIN_THEMES)[number];
export type Theme = BuiltinTheme | (string & {});
export type ResolvedTheme = Exclude<Theme, "system">;

export interface ThemeOption {
  value: string;
  label: string;
}

const STORAGE_KEY = "memos-theme";
const STORAGE_LIGHT_KEY = "memos-theme-light";
const STORAGE_DARK_KEY = "memos-theme-dark";
const STYLE_ELEMENT_ID = "instance-theme";

const BUILTIN_THEME_CONTENT: Record<string, string | null> = {
  default: null,
  "default-dark": defaultDarkThemeContent,
  midnight: midnightThemeContent,
  paper: paperThemeContent,
  whitewall: whitewallThemeContent,
};

const TWEAKCN_THEME_GLOB = import.meta.glob("../themes/tweakcn/*.css", {
  as: "raw",
  eager: true,
});

const RESERVED_THEME_NAMES = new Set(
  Object.keys(BUILTIN_THEME_CONTENT).concat(["system"]),
);

const toTitleCase = (value: string): string => {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getThemeNameFromPath = (path: string): string | null => {
  const parts = path.split("/");
  const file = parts[parts.length - 1];
  if (!file || !file.endsWith(".css")) {
    return null;
  }
  return file.slice(0, -".css".length);
};

const TWEAKCN_THEME_CONTENT: Record<string, string> = {};

for (const [path, css] of Object.entries(TWEAKCN_THEME_GLOB)) {
  const name = getThemeNameFromPath(path);
  if (!name || RESERVED_THEME_NAMES.has(name)) {
    continue;
  }
  TWEAKCN_THEME_CONTENT[name] = css as string;
}

const THEME_CONTENT: Record<string, string | null> = {
  ...BUILTIN_THEME_CONTENT,
  ...TWEAKCN_THEME_CONTENT,
};

const VALID_THEMES = new Set<string>(["system", ...Object.keys(THEME_CONTENT)]);
const DARK_THEME_NAMES = new Set(["default-dark", "midnight"]);

const BUILTIN_THEME_OPTIONS: ThemeOption[] = [
  { value: "system", label: "Sync with system" },
  { value: "default", label: "Light" },
  { value: "default-dark", label: "Dark" },
  { value: "midnight", label: "Midnight" },
  { value: "paper", label: "Paper" },
  { value: "whitewall", label: "Whitewall" },
];

const TWEAKCN_THEME_OPTIONS: ThemeOption[] = Object.keys(TWEAKCN_THEME_CONTENT)
  .sort((a, b) => a.localeCompare(b))
  .map((name) => ({
    value: name,
    label: `${toTitleCase(name)}`,
  }));

export const THEME_OPTIONS: ThemeOption[] = [
  ...BUILTIN_THEME_OPTIONS,
  ...TWEAKCN_THEME_OPTIONS,
];

export interface ThemePreferences {
  light?: Theme;
  dark?: Theme;
}

// ============================================================================
// Theme Validation and Detection
// ============================================================================

/**
 * Validates and normalizes a theme string to a valid theme.
 * Falls back to "default" for invalid themes.
 */
const validateTheme = (theme: string): Theme => {
  return VALID_THEMES.has(theme) ? (theme as Theme) : "default";
};

const normalizePreference = (theme?: string): ResolvedTheme | null => {
  if (!theme) {
    return null;
  }
  if (!VALID_THEMES.has(theme)) {
    return null;
  }
  if (theme === "system") {
    return null;
  }
  return theme as ResolvedTheme;
};

/**
 * Detects the system's preferred color scheme.
 * @returns "default-dark" for dark mode, "default" for light mode
 */
export const getSystemTheme = (): ResolvedTheme => {
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  ) {
    return "default-dark";
  }
  return "default";
};

/**
 * Resolves "system" theme to the actual theme based on OS preference.
 * Other themes are returned as-is after validation.
 */
export const resolveTheme = (
  theme: string,
  preferences?: ThemePreferences,
): ResolvedTheme => {
  const validTheme = validateTheme(theme);
  if (validTheme !== "system") {
    return validTheme;
  }

  const systemTheme = getSystemTheme();
  const fallback = systemTheme === "default-dark" ? "dark" : "light";
  const preferredTheme = normalizePreference(preferences?.[fallback]);
  if (preferredTheme && VALID_THEMES.has(preferredTheme)) {
    return preferredTheme;
  }
  return systemTheme;
};

export const isDarkTheme = (theme: string): boolean => {
  return theme.endsWith("-dark") || DARK_THEME_NAMES.has(theme);
};

// ============================================================================
// LocalStorage Helpers
// ============================================================================

/**
 * Safely reads the theme from localStorage.
 * @returns The stored theme, or null if not found or unavailable
 */
const getStoredTheme = (): Theme | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && VALID_THEMES.has(stored) ? (stored as Theme) : null;
  } catch {
    return null;
  }
};

const getStoredThemePreferences = (): ThemePreferences => {
  try {
    const light = normalizePreference(localStorage.getItem(STORAGE_LIGHT_KEY) || undefined);
    const dark = normalizePreference(localStorage.getItem(STORAGE_DARK_KEY) || undefined);
    return {
      light: light ?? undefined,
      dark: dark ?? undefined,
    };
  } catch {
    return {};
  }
};

export const getThemePreferencesWithFallback = (
  light?: string,
  dark?: string,
): ThemePreferences => {
  const stored = getStoredThemePreferences();
  return {
    light: normalizePreference(light) ?? stored.light,
    dark: normalizePreference(dark) ?? stored.dark,
  };
};

/**
 * Safely stores the theme to localStorage.
 */
const setStoredTheme = (theme: Theme): void => {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage might not be available (SSR, private browsing, etc.)
  }
};

const setStoredThemePreference = (key: string, value?: string | null): void => {
  try {
    if (!value) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, value);
  } catch {
    // localStorage might not be available (SSR, private browsing, etc.)
  }
};

const setStoredThemePreferences = (preferences: ThemePreferences): void => {
  const light = normalizePreference(preferences.light);
  const dark = normalizePreference(preferences.dark);
  setStoredThemePreference(STORAGE_LIGHT_KEY, light ?? null);
  setStoredThemePreference(STORAGE_DARK_KEY, dark ?? null);
};

// ============================================================================
// Theme Selection with Fallbacks
// ============================================================================

/**
 * Gets the theme for initial page load (before user settings are available).
 * Priority: localStorage -> system preference
 */
export const getInitialTheme = (): Theme => {
  return getStoredTheme() ?? "system";
};

/**
 * Gets the theme with full fallback chain.
 * Priority:
 * 1. User setting (if logged in and has preference)
 * 2. localStorage (from previous session)
 * 3. System preference
 */
export const getThemeWithFallback = (userTheme?: string): Theme => {
  // Priority 1: User setting
  if (userTheme && VALID_THEMES.has(userTheme)) {
    return userTheme as Theme;
  }

  // Priority 2: localStorage
  const stored = getStoredTheme();
  if (stored) {
    return stored;
  }

  // Priority 3: System preference
  return "system";
};

// ============================================================================
// DOM Manipulation
// ============================================================================

/**
 * Removes the existing theme style element from the DOM.
 */
const removeThemeStyle = (): void => {
  document.getElementById(STYLE_ELEMENT_ID)?.remove();
};

/**
 * Injects theme CSS into the document head.
 * Skips injection for the default theme (uses base CSS).
 */
const injectThemeStyle = (theme: ResolvedTheme): void => {
  removeThemeStyle();

  if (theme === "default") {
    return; // Use base CSS for default theme
  }

  const css = THEME_CONTENT[theme];
  if (css) {
    const style = document.createElement("style");
    style.id = STYLE_ELEMENT_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }
};

/**
 * Sets the data-theme attribute on the document element.
 * This allows CSS to react to the current theme.
 */
const setThemeAttribute = (theme: ResolvedTheme): void => {
  document.documentElement.setAttribute("data-theme", theme);
};

// ============================================================================
// Main Theme Loading
// ============================================================================

/**
 * Loads and applies a theme.
 * This function:
 * 1. Validates the theme
 * 2. Resolves "system" to actual theme
 * 3. Injects theme CSS
 * 4. Sets data-theme attribute
 * 5. Persists to localStorage
 */
export const loadTheme = (
  themeName: string,
  preferences?: ThemePreferences,
): void => {
  const validTheme = validateTheme(themeName);
  const resolvedPreferences = preferences ?? getStoredThemePreferences();
  const resolvedTheme = resolveTheme(validTheme, resolvedPreferences);

  injectThemeStyle(resolvedTheme);
  setThemeAttribute(resolvedTheme);
  setStoredTheme(validTheme); // Store original theme preference (not resolved)
  if (preferences) {
    setStoredThemePreferences(resolvedPreferences);
  }
};

/**
 * Applies theme early during initial page load to prevent FOUC.
 * Uses only localStorage and system preference (no user settings yet).
 */
export const applyThemeEarly = (): void => {
  const theme = getInitialTheme();
  loadTheme(theme, getStoredThemePreferences());
};

// ============================================================================
// System Theme Listener
// ============================================================================

/**
 * Sets up a listener for OS-level theme preference changes.
 * Supports both modern (addEventListener) and legacy (addListener) APIs.
 *
 * @param onThemeChange - Callback invoked when system theme changes
 * @returns Cleanup function to remove the listener
 */
export const setupSystemThemeListener = (
  onThemeChange: () => void,
): () => void => {
  // Guard against SSR
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  // Modern API (preferred)
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener("change", onThemeChange);
    return () => mediaQuery.removeEventListener("change", onThemeChange);
  }

  // Legacy API (Safari < 14)
  if (mediaQuery.addListener) {
    mediaQuery.addListener(onThemeChange);
    return () => mediaQuery.removeListener(onThemeChange);
  }

  return () => {};
};
