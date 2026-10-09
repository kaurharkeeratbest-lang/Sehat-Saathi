import React, { useCallback, useMemo, useState } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "@react-native-vector-icons/material-design-icons";
import { Card, H2, Body, Caption, Row } from "@/src/ui";
import { colors, spacing, radius, fontSize, gradients } from "@/src/theme";
import { useAppState } from "@/src/store";
import { api } from "@/src/api";
import { t } from "@/src/i18n";

const STATUS_GRADIENT: Record<string, keyof typeof gradients> = {
  all_taken: "calendarGreen",
  partial: "calendarYellow",
  none_taken: "calendarCoral",
  pending: "calendarYellow",
  none: "calendarGrey",
};

export default function Calendar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language, deviceKey } = useAppState();
  const [cur, setCur] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() + 1 }; });
  const [data, setData] = useState<Record<string, any>>({});
  const todayStr = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    try {
      const rows = await api.calendar(deviceKey, cur.y, cur.m);
      const map: Record<string, any> = {};
      rows.forEach((r) => (map[r.date] = r));
      setData(map);
    } catch { setData({}); }
  }, [deviceKey, cur]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const grid = useMemo(() => {
    const first = new Date(cur.y, cur.m - 1, 1);
    const startWeekday = first.getDay(); // 0=Sun
    const lastDay = new Date(cur.y, cur.m, 0).getDate();
    const cells: ({ d: number; iso: string } | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= lastDay; d++) {
      const iso = `${cur.y}-${String(cur.m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ d, iso });
    }
    return cells;
  }, [cur]);

  const monthLabel = new Date(cur.y, cur.m - 1, 1).toLocaleString("default", { month: "long", year: "numeric" });
  const nav = (dir: number) => {
    let { y, m } = cur; m += dir;
    if (m === 0) { m = 12; y--; } else if (m === 13) { m = 1; y++; }
    setCur({ y, m });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: 100, gap: spacing.md }}>
      <H2>{t(language, "monthlyCalendar")}</H2>
      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Pressable testID="cal-prev" onPress={() => nav(-1)} hitSlop={12}><Icon name="chevron-left" size={32} color={colors.onSurface} /></Pressable>
          <Body style={{ fontWeight: "700", fontSize: fontSize.lg }}>{monthLabel}</Body>
          <Pressable testID="cal-next" onPress={() => nav(1)} hitSlop={12}><Icon name="chevron-right" size={32} color={colors.onSurface} /></Pressable>
        </Row>
        <Row style={{ marginTop: spacing.sm }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <View key={i} style={{ flex: 1, alignItems: "center" }}><Caption>{d}</Caption></View>
          ))}
        </Row>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
          {grid.map((cell, idx) => {
            if (!cell) return <View key={idx} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 3 }} />;
            const info = data[cell.iso];
            const g = STATUS_GRADIENT[info?.status || "none"] || "calendarGrey";
            const isToday = cell.iso === todayStr;
            return (
              <Pressable key={idx} testID={`cal-${cell.iso}`} onPress={() => router.push(`/daily/${cell.iso}`)}
                style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 3 }}>
                <LinearGradient
                  colors={gradients[g] as unknown as [string, string, ...string[]]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{
                    flex: 1,
                    borderRadius: radius.md,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: isToday ? 2.5 : 1,
                    borderColor: isToday ? colors.info : "rgba(0,0,0,0.04)",
                  }}
                >
                  <Body style={{ fontWeight: isToday ? "800" : "700", color: colors.onSurface }}>{cell.d}</Body>
                  {info && info.total > 0 && <Caption style={{ fontSize: 11 }}>{info.taken}/{info.total}</Caption>}
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        {([
          ["calendarGreen", t(language, "legendAll")],
          ["calendarYellow", t(language, "legendPartial")],
          ["calendarCoral", t(language, "legendNone")],
          ["calendarGrey", t(language, "legendEmpty")],
        ] as const).map(([g, label]) => (
          <Row key={g} style={{ marginVertical: 4 }}>
            <LinearGradient
              colors={gradients[g] as unknown as [string, string, ...string[]]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ width: 28, height: 28, borderRadius: 8, marginRight: 10 }}
            />
            <Body>{label}</Body>
          </Row>
        ))}
        <Row style={{ marginVertical: 4 }}>
          <View style={{ width: 28, height: 28, borderRadius: 8, marginRight: 10, borderWidth: 2.5, borderColor: colors.info }} />
          <Body>{t(language, "legendToday")}</Body>
        </Row>
      </Card>
    </ScrollView>
  );
}
