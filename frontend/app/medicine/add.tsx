// Add/Edit medicine form (reused for both). Query param ?id= means edit.
import React, { useEffect, useState } from "react";
import { ScrollView, View, Pressable, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { Btn, Card, H2, Body, Caption, Label, TxtInput, Row } from "@/src/ui";
import { colors, spacing, radius, fontSize } from "@/src/theme";
import { useAppState } from "@/src/store";
import { api } from "@/src/api";
import { t } from "@/src/i18n";

const FORMS = ["tablet", "capsule", "syrup", "drop", "injection"] as const;

export default function AddMedicine() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language, deviceKey } = useAppState();
  const { id, scan } = useLocalSearchParams<{ id?: string; scan?: string }>();
  const isEdit = !!id;

  const [name, setName] = useState("");
  const [strength, setStrength] = useState("");
  const [formulation, setFormulation] = useState<string>("tablet");
  const [doseAmount, setDoseAmount] = useState("1 tablet");
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [startDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [food, setFood] = useState("");
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<any>(null);

  useEffect(() => {
    if (isEdit && id) {
      api.getMedicine(id).then((m) => {
        setCurrent(m);
        setName(m.name);
        setStrength(m.strength || "");
        setFormulation(m.formulation || "tablet");
        const latest = m.schedules?.at(-1);
        if (latest) {
          setDoseAmount(latest.dose_amount);
          setTimes(latest.times || ["08:00"]);
          setFood(latest.food_instructions || "");
          setNotes(latest.notes || "");
        }
      }).catch(() => {});
    } else if (scan) {
      try {
        const p = JSON.parse(decodeURIComponent(String(scan)));
        if (p.name) setName(p.name);
        if (p.strength) setStrength(p.strength);
        if (p.formulation) setFormulation(String(p.formulation).toLowerCase());
      } catch {}
    }
  }, [id, scan, isEdit]);

  const updateTime = (idx: number, val: string) => setTimes((ts) => ts.map((t, i) => (i === idx ? val : t)));
  const addTime = () => setTimes((ts) => [...ts, "20:00"]);
  const removeTime = (idx: number) => setTimes((ts) => ts.filter((_, i) => i !== idx));

  const save = async () => {
    if (!name.trim()) { Alert.alert(t(language, "medicineName")); return; }
    if (times.length === 0) { Alert.alert(t(language, "times")); return; }
    setSaving(true);
    try {
      if (isEdit && id) {
        await api.updateMedicine(id, { name, strength, formulation });
        await api.addSchedule(id, {
          dose_amount: doseAmount, dose_unit: formulation, times,
          start_date: startDate, food_instructions: food, notes,
        });
      } else {
        await api.createMedicine({
          device_key: deviceKey, name, strength, formulation,
          dose_amount: doseAmount, dose_unit: formulation, times,
          start_date: startDate, food_instructions: food, notes,
        });
      }
      router.back();
    } catch (e: any) {
      Alert.alert(t(language, "errorSave"), String(e?.message ?? ""));
    } finally { setSaving(false); }
  };

  const discontinue = () => {
    if (!id) return;
    Alert.alert(t(language, "deleteConfirm"), undefined, [
      { text: t(language, "cancel"), style: "cancel" },
      { text: t(language, "discontinue"), style: "destructive", onPress: async () => { await api.discontinueMedicine(id); router.back(); } },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 120, gap: spacing.md }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Pressable testID="back-btn" onPress={() => router.back()} hitSlop={16}>
          <Icon name="arrow-left" size={30} color={colors.onSurface} />
        </Pressable>
        <H2>{isEdit ? t(language, "edit") : t(language, "addMedicine")}</H2>
        <View style={{ width: 30 }} />
      </Row>

      <Card>
        <Label>{t(language, "medicineName")}</Label>
        <TxtInput testID="name-input" value={name} onChangeText={setName} />
        <Label>{t(language, "strength")}</Label>
        <TxtInput testID="strength-input" value={strength} onChangeText={setStrength} />
        <Label>{t(language, "formulation")}</Label>
        <Row style={{ flexWrap: "wrap", gap: 8 }}>
          {FORMS.map((f) => (
            <Pressable key={f} testID={`form-${f}`} onPress={() => setFormulation(f)}
              style={{
                paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
                backgroundColor: formulation === f ? colors.brandPrimary : colors.surfaceTertiary,
                borderWidth: 1, borderColor: formulation === f ? colors.brandPrimary : colors.border,
              }}>
              <Caption style={{ color: formulation === f ? colors.onBrandPrimary : colors.onSurface, fontWeight: "700" }}>{t(language, f as any)}</Caption>
            </Pressable>
          ))}
        </Row>
      </Card>

      <Card>
        <Label>{t(language, "doseAmount")}</Label>
        <TxtInput testID="dose-input" value={doseAmount} onChangeText={setDoseAmount} />
        <Label>{t(language, "times")}</Label>
        {times.map((tm, idx) => (
          <Row key={idx} style={{ gap: 8, marginBottom: 8 }}>
            <TxtInput testID={`time-${idx}`} value={tm} onChangeText={(v) => updateTime(idx, v)} style={{ flex: 1 }} placeholder="HH:MM" />
            <Pressable testID={`time-remove-${idx}`} onPress={() => removeTime(idx)} style={{ padding: 10 }}>
              <Icon name="close-circle-outline" size={28} color={colors.muted} />
            </Pressable>
          </Row>
        ))}
        <Btn testID="add-time-btn" variant="ghost" label={`+ ${t(language, "addTime")}`} onPress={addTime} />
        <Label>{t(language, "foodInstructions")}</Label>
        <TxtInput testID="food-input" value={food} onChangeText={setFood} />
        <Label>{t(language, "notes")}</Label>
        <TxtInput testID="notes-input" value={notes} onChangeText={setNotes} multiline numberOfLines={3} style={{ minHeight: 80 }} />
      </Card>

      <Btn testID="save-btn" loading={saving} label={t(language, "save")} onPress={save} />
      {isEdit && (
        <Btn testID="discontinue-btn" variant="danger" label={t(language, "discontinue")} onPress={discontinue} />
      )}
      {isEdit && current?.schedules?.length > 1 && (
        <Card>
          <Body style={{ fontWeight: "700" }}>{t(language, "scheduleHistory")}</Body>
          {current.schedules.map((s: any) => (
            <Caption key={s.id} style={{ marginTop: 6 }}>{s.start_date}  •  {s.dose_amount}  •  {s.times.join(", ")}</Caption>
          ))}
        </Card>
      )}
      <Caption>{t(language, "safetyNote")}</Caption>
    </ScrollView>
  );
}
