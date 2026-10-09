import React, { useCallback, useState } from "react";
import { View, FlatList, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { Btn, Card, H2, H3, Body, Caption, Row } from "@/src/ui";
import { colors, spacing, radius, fontSize } from "@/src/theme";
import { useAppState } from "@/src/store";
import { api } from "@/src/api";
import { t } from "@/src/i18n";

export default function Medicines() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language, deviceKey } = useAppState();
  const [items, setItems] = useState<any[]>([]);
  const load = useCallback(async () => {
    try { setItems(await api.listMedicines(deviceKey)); } catch { setItems([]); }
  }, [deviceKey]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary, paddingTop: insets.top + spacing.md }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <H2>{t(language, "myMedicines")}</H2>
      </View>
      <FlatList
        data={items}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: 120 }}
        ListEmptyComponent={
          <Card>
            <View style={{ alignItems: "center", padding: spacing.lg, gap: spacing.sm }}>
              <Icon name="pill-off" size={56} color={colors.muted} />
              <Body style={{ textAlign: "center" }}>{t(language, "medicineBoxEmpty")}</Body>
            </View>
          </Card>
        }
        renderItem={({ item }) => (
          <Pressable testID={`med-row-${item.id}`} onPress={() => router.push(`/medicine/${item.id}`)}>
            <Card>
              <Row style={{ justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <H3>{item.name}</H3>
                  <Caption>{item.strength}  •  {t(language, (item.formulation || "tablet") as any)}</Caption>
                  <Caption style={{ marginTop: 4 }}>
                    {(item.schedules?.at(-1)?.times || []).join(", ")}  •  {t(language, item.status as any) || item.status}
                  </Caption>
                </View>
                <Icon name="chevron-right" size={30} color={colors.muted} />
              </Row>
            </Card>
          </Pressable>
        )}
      />
      <View style={{ position: "absolute", left: spacing.lg, right: spacing.lg, bottom: insets.bottom + 20 }}>
        <Btn testID="add-medicine-btn" label={`+ ${t(language, "addMedicine")}`} onPress={() => router.push("/medicine/add")} />
      </View>
    </View>
  );
}
