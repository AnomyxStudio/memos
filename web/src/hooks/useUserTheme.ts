import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getThemePreferencesWithFallback,
  getThemeWithFallback,
  loadTheme,
  setupSystemThemeListener,
} from "@/utils/theme";

/**
 * Hook that reactively applies user theme preference.
 * Priority: User setting → localStorage → system preference
 */
export const useUserTheme = () => {
  const { userGeneralSetting } = useAuth();

  // Apply theme when user setting changes or user logs in
  useEffect(() => {
    if (!userGeneralSetting) {
      return;
    }
    const theme = getThemeWithFallback(userGeneralSetting.theme);
    const preferences = getThemePreferencesWithFallback(
      userGeneralSetting.themeLight,
      userGeneralSetting.themeDark,
    );
    loadTheme(theme, preferences);
  }, [
    userGeneralSetting?.theme,
    userGeneralSetting?.themeLight,
    userGeneralSetting?.themeDark,
  ]);

  // Listen for system theme changes when using "system" theme
  useEffect(() => {
    const theme = getThemeWithFallback(userGeneralSetting?.theme);
    const preferences = getThemePreferencesWithFallback(
      userGeneralSetting?.themeLight,
      userGeneralSetting?.themeDark,
    );

    // Only set up listener if theme is "system"
    if (theme !== "system") {
      return;
    }

    // Set up listener for OS theme preference changes
    const cleanup = setupSystemThemeListener(() => {
      loadTheme(theme, preferences);
    });

    return cleanup;
  }, [
    userGeneralSetting?.theme,
    userGeneralSetting?.themeLight,
    userGeneralSetting?.themeDark,
  ]);
};
