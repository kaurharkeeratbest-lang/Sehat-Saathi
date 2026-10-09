// Sehat Saathi design tokens — senior-first, calm, trustworthy.
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FFFFFF",
  onSurface: "#0F172A",
  surfaceSecondary: "#F5F7FA",
  onSurfaceSecondary: "#1E293B",
  surfaceTertiary: "#E9EFF5",
  onSurfaceTertiary: "#334155",
  surfaceInverse: "#1E293B",
  onSurfaceInverse: "#FFFFFF",
  muted: "#475569",

  brand: "#E85D04",
  onBrand: "#FFFFFF",
  brandPrimary: "#E85D04",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#F3C8A5",
  onBrandSecondary: "#4A1C00",
  brandTertiary: "#FBE4D0",
  onBrandTertiary: "#4A1C00",

  success: "#2E854B",
  onSuccess: "#FFFFFF",
  warning: "#D97706",
  onWarning: "#FFFFFF",
  error: "#DC2626",
  onError: "#FFFFFF",
  info: "#0284C7",
  onInfo: "#FFFFFF",

  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  divider: "#E2E8F0",
};

export type ThemeColors = typeof light;
export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}
setColorScheme?.(themes.dark ? null : defaultScheme);

export const colors = light;

export const gradients = {
  peach: ["#FFF7ED", "#FBE4D0", "#F3C8A5"] as const,
  cloud: ["#FFFFFF", "#F5F7FA", "#E9EFF5"] as const,
  sage: ["#E5F7E9", "#A9E5BD", "#65C98B"] as const,
  sky: ["#EAF4FF", "#BBDCFB", "#82B8F0"] as const,
  calendarGreen: ["#E5F7E9", "#A9E5BD", "#65C98B"] as const,
  calendarYellow: ["#FFF8D9", "#FFE7A3", "#F6C66A"] as const,
  calendarCoral: ["#FFE8E3", "#FFB8AD", "#F27B76"] as const,
  calendarGrey: ["#F4F6F8", "#E5EAF0", "#D5DDE6"] as const,
};

export const spacing = { xs: 8, sm: 12, md: 16, lg: 24, xl: 32, "2xl": 48, "3xl": 64 };
export const radius = { sm: 8, md: 16, lg: 24, pill: 999 };
export const fontSize = { sm: 16, base: 18, lg: 22, xl: 28, "2xl": 36 };

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors: c } = useTheme();
    return useMemo(() => StyleSheet.create(factory(c)), [c]);
  };
}
