// Home dashboard.
import React, { useCallback, useState } from "react";
import { ScrollView, View, Pressable, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Btn, Card, H1, H2, H3, Body, Caption, Row } from "@/src/ui";
import { colors, spacing, radius, fontSize, gradients } from "@/src/theme";
import { useAppState } from "@/src/store";
import { api } from "@/src/api";
import { t } from "@/src/i18n";

function todayISO() { return new Date().toISOString().slice(0, 10); }
function greeting(lang: string) {
  const h = new Date().getHours();
  if (h < 12) return t(lang, "greetingMorning");
  if (h < 17) return t(lang, "greetingAfternoon");
  return t(lang, "greetingEvening");
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language, deviceKey } = useAppState();
  const [doses, setDoses] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setDoses(await api.scheduledDoses(deviceKey, todayISO())); } catch { setDoses([]); }
  }, [deviceKey]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const taken = doses.filter((d) => d.status === "taken").length;
  const now = new Date();
  const next = doses.find((d) => {
    if (d.status !== "pending") return false;
    const [h, m] = d.scheduled_time.split(":").map(Number);
    const t2 = new Date(); t2.setHours(h, m, 0, 0);
    return t2 >= now || true;
  });

  const markTaken = async (d: any) => {
    try {
      await api.setDoseStatus({
        device_key: deviceKey,
        medicine_id: d.medicine_id,
        schedule_version_id: d.schedule_version_id,
        scheduled_date: d.scheduled_date,
        scheduled_time: d.scheduled_time,
        status: "taken",
      });
      load();
    } catch {}
  };
  const markSkipped = async (d: any) => {
    try {
      await api.setDoseStatus({
        device_key: deviceKey,
        medicine_id: d.medicine_id,
        schedule_version_id: d.schedule_version_id,
        scheduled_date: d.scheduled_date,
        scheduled_time: d.scheduled_time,
        status: "skipped",
      });
      load();
    } catch {}
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: spacing.xl + 20, gap: spacing.md }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <View>
        <Caption>{greeting(language)}</Caption>
        <H1 style={{ color: colors.brandPrimary }}>{t(language, "appName")}</H1>
      </View>

      <LinearGradient colors={gradients.peach as unknown as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.brandSecondary }}>
        <Caption style={{ color: colors.onBrandSecondary }}>{t(language, "nextMedicine")}</Caption>
        {next ? (
          <>
            <H2 style={{ color: colors.onBrandSecondary, marginTop: 4 }}>{next.medicine_name}</H2>
            <Row style={{ marginTop: 6, gap: 10 }}>
              <Icon name="clock-outline" size={22} color={colors.onBrandSecondary} />
              <Body style={{ color: colors.onBrandSecondary, fontWeight: "600" }}>{next.scheduled_time} • {next.dose_amount}</Body>
            </Row>
            <Row style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <Btn testID="next-taken-btn" variant="success" label={t(language, "markTaken")} onPress={() => markTaken(next)} style={{ flex: 1 }} />
              <Btn testID="next-skip-btn" variant="ghost" label={t(language, "markSkipped")} onPress={() => markSkipped(next)} style={{ flex: 1 }} />
            </Row>
          </>
        ) : (
          <Body style={{ color: colors.onBrandSecondary, marginTop: 6 }}>{t(language, "noNext")}</Body>
        )}
      </LinearGradient>

      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <H3>{t(language, "todaySchedule")}</H3>
          <Caption>{t(language, "progress", { taken, total: doses.length })}</Caption>
        </Row>
        {doses.length === 0 ? (
          <Body style={{ marginTop: spacing.sm }}>{t(language, "noNext")}</Body>
        ) : (
          doses.map((d) => (
            <View key={d.dose_id} style={{ paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
              <Row style={{ justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: "700", color: colors.onSurface }}>{d.medicine_name} <Caption>• {d.dose_amount}</Caption></Body>
                  <Caption>{d.scheduled_time}  •  {d.status === "taken" ? t(language, "taken") : d.status === "skipped" ? t(language, "skipped") : t(language, "pending")}</Caption>
                </View>
                {d.status === "pending" ? (
                  <Row style={{ gap: 8 }}>
                    <Pressable testID={`taken-${d.dose_id}`} onPress={() => markTaken(d)} style={{ padding: 8 }}>
                      <Icon name="check-circle" size={32} color={colors.success} />
                    </Pressable>
                    <Pressable testID={`skip-${d.dose_id}`} onPress={() => markSkipped(d)} style={{ padding: 8 }}>
                      <Icon name="close-circle-outline" size={32} color={colors.muted} />
                    </Pressable>
                  </Row>
                ) : (
                  <Icon name={d.status === "taken" ? "check-circle" : "minus-circle-outline"} size={28} color={d.status === "taken" ? colors.success : colors.warning} />
                )}
              </Row>
            </View>
          ))
        )}
      </Card>

      <Row style={{ gap: spacing.sm, flexWrap: "wrap" }}>
        <Pressable testID="quick-scan" onPress={() => router.push("/scan")} style={{ flex: 1, minWidth: 140 }}>
          <LinearGradient colors={gradients.sky as unknown as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.md, padding: spacing.md, alignItems: "center", gap: 6, minHeight: 100 }}>
            <Icon name="camera-outline" size={30} color={colors.info} />
            <Body style={{ fontWeight: "700", color: colors.info }}>{t(language, "scanMedicine")}</Body>
          </LinearGradient>
        </Pressable>
        <Pressable testID="quick-add" onPress={() => router.push("/medicine/add")} style={{ flex: 1, minWidth: 140 }}>
          <LinearGradient colors={gradients.sage as unknown as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.md, padding: spacing.md, alignItems: "center", gap: 6, minHeight: 100 }}>
            <Icon name="plus-circle" size={30} color={colors.success} />
            <Body style={{ fontWeight: "700", color: colors.success }}>{t(language, "addMedicine")}</Body>
          </LinearGradient>
        </Pressable>
        <Pressable testID="quick-settings" onPress={() => router.push("/settings")} style={{ flex: 1, minWidth: 140 }}>
          <LinearGradient colors={gradients.cloud as unknown as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.md, padding: spacing.md, alignItems: "center", gap: 6, minHeight: 100, borderWidth: 1, borderColor: colors.border }}>
            <Icon name="cog-outline" size={30} color={colors.onSurface} />
            <Body style={{ fontWeight: "700" }}>{t(language, "settings")}</Body>
          </LinearGradient>
        </Pressable>
      </Row>

      <Caption style={{ textAlign: "center", marginTop: spacing.md }}>{t(language, "safetyNote")}</Caption>
    </ScrollView>
  );
}
