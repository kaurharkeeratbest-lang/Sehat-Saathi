// Daily health record for a given date.
import React, { useCallback, useState } from "react";
import { ScrollView, View, Pressable } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { Btn, Card, H2, H3, Body, Caption, Label, TxtInput, Row } from "@/src/ui";
import { colors, spacing, radius } from "@/src/theme";
import { useAppState } from "@/src/store";
import { api } from "@/src/api";
import { t } from "@/src/i18n";

export default function Daily() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language, deviceKey } = useAppState();
  const [data, setData] = useState<any>({ doses: [], notes: "" });
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    try { const d = await api.daily(deviceKey, date); setData(d); setNotes(d.notes || ""); } catch {}
  }, [deviceKey, date]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveNote = async () => { try { await api.setDailyNote({ device_key: deviceKey, date, notes }); load(); } catch {} };
  const update = async (d: any, status: string) => {
    try {
      await api.setDoseStatus({
        device_key: deviceKey, medicine_id: d.medicine_id, schedule_version_id: d.schedule_version_id,
        scheduled_date: d.scheduled_date, scheduled_time: d.scheduled_time, status,
      });
      load();
    } catch {}
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 32, gap: spacing.md }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Pressable testID="daily-back" onPress={() => router.back()} hitSlop={16}><Icon name="arrow-left" size={30} color={colors.onSurface} /></Pressable>
        <H2>{date}</H2>
        <View style={{ width: 30 }} />
      </Row>
      <Caption>{t(language, "dailyRecord")}</Caption>

      {data.doses.length === 0 ? (
        <Card><Body>{t(language, "legendEmpty")}</Body></Card>
      ) : data.doses.map((d: any) => (
        <Card key={d.dose_id}>
          <Row style={{ justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <H3>{d.medicine_name}</H3>
              <Caption>{d.scheduled_time}  •  {d.dose_amount}</Caption>
              <Caption style={{ marginTop: 4, color: d.status === "taken" ? colors.success : d.status === "skipped" ? colors.warning : colors.muted }}>
                {d.status === "taken" ? t(language, "taken") : d.status === "skipped" ? t(language, "skipped") : t(language, "pending")}
              </Caption>
            </View>
            <Row style={{ gap: 6 }}>
              <Pressable testID={`d-taken-${d.dose_id}`} onPress={() => update(d, "taken")}><Icon name="check-circle" size={32} color={d.status === "taken" ? colors.success : colors.muted} /></Pressable>
              <Pressable testID={`d-skip-${d.dose_id}`} onPress={() => update(d, "skipped")}><Icon name="close-circle" size={32} color={d.status === "skipped" ? colors.warning : colors.muted} /></Pressable>
              <Pressable testID={`d-reset-${d.dose_id}`} onPress={() => update(d, "pending")}><Icon name="restore" size={30} color={colors.info} /></Pressable>
            </Row>
          </Row>
        </Card>
      ))}

      <Card>
        <Label>{t(language, "healthNotes")}</Label>
        <TxtInput testID="daily-note" value={notes} onChangeText={setNotes} multiline numberOfLines={4} style={{ minHeight: 100 }} />
        <Btn testID="daily-save-note" label={t(language, "save")} onPress={saveNote} style={{ marginTop: 10 }} />
      </Card>
    </ScrollView>
  );
}
