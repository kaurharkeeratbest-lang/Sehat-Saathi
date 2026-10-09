// Scan medicine with camera / gallery, send to backend Gemini vision OCR.
import React, { useState } from "react";
import { ScrollView, View, Pressable, ActivityIndicator, Image, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import Icon from "@react-native-vector-icons/material-design-icons";
import { Btn, Card, H2, Body, Caption, Row, Label, TxtInput } from "@/src/ui";
import { colors, spacing, radius } from "@/src/theme";
import { useAppState } from "@/src/store";
import { api } from "@/src/api";
import { t } from "@/src/i18n";

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language, deviceKey } = useAppState();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  const pick = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission required"); return; }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6, mediaTypes: ImagePicker.MediaTypeOptions.Images })
      : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setImageUri(a.uri);
    setResult(null);
    if (!a.base64) { Alert.alert("Image load failed"); return; }
    setLoading(true);
    try {
      const r = await api.scan({ device_key: deviceKey, image_base64: a.base64, mime_type: "image/jpeg" });
      setResult(r);
    } catch (e: any) {
      Alert.alert(t(language, "errorNetwork"), String(e?.message || e));
    } finally { setLoading(false); }
  };

  const confirmSave = () => {
    if (!result?.result) return;
    const payload = encodeURIComponent(JSON.stringify(result.result));
    router.replace(`/medicine/add?scan=${payload}`);
  };

  const confidence = result?.result?.confidence || "low";
  const confText = confidence === "high" ? t(language, "confidenceHigh") : confidence === "medium" ? t(language, "confidenceMed") : t(language, "confidenceLow");

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 32, gap: spacing.md }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Pressable testID="scan-back" onPress={() => router.back()} hitSlop={16}>
          <Icon name="arrow-left" size={30} color={colors.onSurface} />
        </Pressable>
        <H2>{t(language, "scanMedicine")}</H2>
        <View style={{ width: 30 }} />
      </Row>

      <Card>
        <Body>{t(language, "scanInstructions")}</Body>
      </Card>

      {imageUri && (
        <Image source={{ uri: imageUri }} style={{ width: "100%", aspectRatio: 1, borderRadius: radius.lg, backgroundColor: colors.surfaceTertiary }} resizeMode="cover" />
      )}

      <Row style={{ gap: spacing.sm }}>
        <Btn testID="scan-camera" label={t(language, "capture")} onPress={() => pick(true)} style={{ flex: 1 }} />
        <Btn testID="scan-gallery" variant="secondary" label={t(language, "fromGallery")} onPress={() => pick(false)} style={{ flex: 1 }} />
      </Row>

      {loading && (
        <Card><Row><ActivityIndicator color={colors.brandPrimary} /><Body style={{ marginLeft: 10 }}>Analyzing…</Body></Row></Card>
      )}

      {result?.result && !loading && (
        <Card>
          <H2>{t(language, "scanResult")}</H2>
          <Caption style={{ marginTop: 4, color: confidence === "high" ? colors.success : confidence === "medium" ? colors.warning : colors.error }}>{confText}</Caption>
          <View style={{ marginTop: spacing.sm, gap: 8 }}>
            {["name", "strength", "formulation", "manufacturer", "instructions", "batch_or_expiry"].map((k) => (
              <View key={k}>
                <Caption style={{ textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</Caption>
                <Body style={{ fontWeight: "600" }}>{result.result[k] || "—"}</Body>
              </View>
            ))}
            {result.possible_match_medicine_id && (
              <Caption style={{ color: colors.info }}>Possible match with saved medicine ✓ (please verify)</Caption>
            )}
          </View>
          <Row style={{ marginTop: spacing.md, gap: 8 }}>
            <Btn testID="scan-confirm" variant="success" label={t(language, "confirmSave")} onPress={confirmSave} style={{ flex: 1 }} />
            <Btn testID="scan-retake" variant="ghost" label={t(language, "retake")} onPress={() => { setResult(null); setImageUri(null); }} style={{ flex: 1 }} />
          </Row>
        </Card>
      )}
    </ScrollView>
  );
}
