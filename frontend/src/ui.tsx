// Shared UI primitives.
import React from "react";
import { Pressable, Text, View, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fontSize, radius, spacing, gradients } from "./theme";

export function GradientBg({
  variant = "cloud",
  style,
  children,
}: {
  variant?: keyof typeof gradients;
  style?: ViewStyle;
  children?: React.ReactNode;
}) {
  return (
    <LinearGradient
      colors={gradients[variant] as unknown as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </LinearGradient>
  );
}

export function Btn({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  testID,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "success" | "danger";
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  style?: ViewStyle;
}) {
  const palette: Record<string, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.brandPrimary, fg: colors.onBrandPrimary },
    secondary: { bg: colors.brandTertiary, fg: colors.onBrandTertiary },
    ghost: { bg: "transparent", fg: colors.onSurface, border: colors.borderStrong },
    success: { bg: colors.success, fg: colors.onSuccess },
    danger: { bg: colors.error, fg: colors.onError },
  };
  const p = palette[variant];
  return (
    <Pressable
      testID={testID}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: p.bg,
          borderWidth: p.border ? 1.5 : 0,
          borderColor: p.border,
          paddingVertical: 16,
          paddingHorizontal: 20,
          borderRadius: radius.md,
          minHeight: 56,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <Text style={{ color: p.fg, fontSize: fontSize.base, fontWeight: "700" }}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function TxtInput(props: React.ComponentProps<typeof import("react-native").TextInput>) {
  const { TextInput } = require("react-native") as typeof import("react-native");
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      style={[
        {
          borderWidth: 1.5,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: 14,
          fontSize: fontSize.base,
          color: colors.onSurface,
          backgroundColor: colors.surface,
          minHeight: 52,
        },
        props.style as TextStyle,
      ]}
    />
  );
}

export const Label = ({ children }: { children: React.ReactNode }) => (
  <Text style={{ color: colors.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: "600", marginBottom: 6 }}>
    {children}
  </Text>
);

export const H1 = ({ children, style }: { children: React.ReactNode; style?: TextStyle }) => (
  <Text style={[{ fontSize: fontSize["2xl"], fontWeight: "800", color: colors.onSurface }, style]}>{children}</Text>
);
export const H2 = ({ children, style }: { children: React.ReactNode; style?: TextStyle }) => (
  <Text style={[{ fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface }, style]}>{children}</Text>
);
export const H3 = ({ children, style }: { children: React.ReactNode; style?: TextStyle }) => (
  <Text style={[{ fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface }, style]}>{children}</Text>
);
export const Body = ({ children, style }: { children: React.ReactNode; style?: TextStyle }) => (
  <Text style={[{ fontSize: fontSize.base, color: colors.onSurfaceSecondary }, style]}>{children}</Text>
);
export const Caption = ({ children, style }: { children: React.ReactNode; style?: TextStyle }) => (
  <Text style={[{ fontSize: fontSize.sm, color: colors.muted }, style]}>{children}</Text>
);

export const Row = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[{ flexDirection: "row", alignItems: "center" }, style]}>{children}</View>
);
