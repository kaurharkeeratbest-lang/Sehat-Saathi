import { Tabs } from "expo-router";
import { Platform } from "react-native";
import Icon from "@react-native-vector-icons/material-design-icons";
import { colors, fontSize } from "@/src/theme";
import { useAppState } from "@/src/store";
import { t } from "@/src/i18n";

export default function TabsLayout() {
  const { language } = useAppState();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 68 } : {}),
        },
        tabBarLabelStyle: { fontSize: 13, fontWeight: "600" },
        tabBarItemStyle: { alignSelf: "center" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t(language, "tabHome"), tabBarIcon: ({ color, size }) => <Icon name="home-heart" size={size} color={color} /> }} />
      <Tabs.Screen name="medicines" options={{ title: t(language, "tabMeds"), tabBarIcon: ({ color, size }) => <Icon name="pill" size={size} color={color} /> }} />
      <Tabs.Screen name="calendar" options={{ title: t(language, "tabCalendar"), tabBarIcon: ({ color, size }) => <Icon name="calendar-month" size={size} color={color} /> }} />
      <Tabs.Screen name="assistant" options={{ title: t(language, "tabAssistant"), tabBarIcon: ({ color, size }) => <Icon name="microphone" size={size} color={color} /> }} />
    </Tabs>
  );
}
