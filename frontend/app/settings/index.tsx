// Settings: language, emergency contact, privacy info — all in one route.
import React, { useEffect, useState } from "react";
import { ScrollView, View, Pressable, Switch, FlatList, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { Btn, Card, H2, H3, Body, Caption, Label, TxtInput, Row } from "@/src/ui";
import { colors, spacing, radius, fontSize } from "@/src/theme";
import { useAppState } from "@/src/store";
import { api } from "@/src/api";
import { t, LANGUAGES } from "@/src/i18n";

type Section = "home" | "language" | "emergency" | "privacy";

export default function Settings() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language, setLanguage, voiceEnabled, setVoiceEnabled, deviceKey } = useAppState();
  const [section, setSection] = useState<Section>("home");
  const [contact, setContact] = useState<any>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    api.getContact(deviceKey).then((c) => {
      setContact(c);
      if (c) { setName(c.name); setPhone(c.phone); setConsent(!!c.consent); }
    }).catch(() => {});
  }, [deviceKey]);

  const saveContact = async () => {
    try {
      await api.setContact({ device_key: deviceKey, name, phone, language, consent, enabled: true });
      Alert.alert("✓");
      setSection("home");
    } catch (e: any) { Alert.alert(t(language, "errorSave"), String(e?.message)); }
  };
  const removeContact = async () => {
    try { await api.deleteContact(deviceKey); setContact(null); setName(""); setPhone(""); setConsent(false); } catch {}
  };

  const header = (title: string) => (
    <Row style={{ justifyContent: "space-between", marginBottom: spacing.md }}>
      <Pressable testID="settings-back" onPress={() => setSection("home")} hitSlop={16}><Icon name="arrow-left" size={30} color={colors.onSurface} /></Pressable>
      <H2>{title}</H2>
      <View style={{ width: 30 }} />
    </Row>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 32, gap: spacing.md }}>
      {section === "home" && (
        <>
          <Row style={{ justifyContent: "space-between" }}>
            <Pressable testID="root-back" onPress={() => router.back()} hitSlop={16}><Icon name="arrow-left" size={30} color={colors.onSurface} /></Pressable>
            <H2>{t(language, "settings")}</H2>
            <View style={{ width: 30 }} />
          </Row>

          <Pressable testID="settings-language" onPress={() => setSection("language")}>
            <Card>
              <Row style={{ justifyContent: "space-between" }}>
                <Row style={{ gap: 12 }}><Icon name="translate" size={28} color={colors.brandPrimary} /><Body style={{ fontWeight: "700" }}>{t(language, "language")}</Body></Row>
                <Caption>{LANGUAGES.find((l) => l.code === language)?.native}</Caption>
              </Row>
            </Card>
          </Pressable>

          <Card>
            <Row style={{ justifyContent: "space-between" }}>
              <Row style={{ gap: 12 }}><Icon name="microphone" size={28} color={colors.brandPrimary} /><Body style={{ fontWeight: "700" }}>{t(language, "enableAssistant")}</Body></Row>
              <Switch testID="voice-toggle" value={voiceEnabled} onValueChange={setVoiceEnabled} />
            </Row>
          </Card>

          <Pressable testID="settings-emergency" onPress={() => setSection("emergency")}>
            <Card>
              <Row style={{ justifyContent: "space-between" }}>
                <Row style={{ gap: 12 }}><Icon name="phone-alert" size={28} color={colors.brandPrimary} /><Body style={{ fontWeight: "700" }}>{t(language, "emergencyContact")}</Body></Row>
                <Caption>{contact?.name || t(language, "skip")}</Caption>
              </Row>
            </Card>
          </Pressable>

          <Pressable testID="settings-privacy" onPress={() => setSection("privacy")}>
            <Card>
              <Row style={{ gap: 12 }}><Icon name="shield-lock-outline" size={28} color={colors.brandPrimary} /><Body style={{ fontWeight: "700" }}>{t(language, "privacy")}</Body></Row>
            </Card>
          </Pressable>

          <Caption>{t(language, "safetyNote")}</Caption>
        </>
      )}

      {section === "language" && (
        <>
          {header(t(language, "language"))}
          <FlatList
            data={LANGUAGES}
            scrollEnabled={false}
            keyExtractor={(l) => l.code}
            renderItem={({ item }) => (
              <Pressable testID={`set-lang-${item.code}`} onPress={() => { setLanguage(item.code); }}
                style={{
                  padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5,
                  borderColor: language === item.code ? colors.brandPrimary : colors.border,
                  backgroundColor: language === item.code ? colors.brandTertiary : colors.surface,
                  marginBottom: 10, minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                }}
              >
                <View><Body style={{ fontWeight: "700" }}>{item.native}</Body><Caption>{item.english}{item.validated ? "" : "  •  limited"}</Caption></View>
                {language === item.code && <Icon name="check-circle" size={28} color={colors.brandPrimary} />}
              </Pressable>
            )}
          />
        </>
      )}

      {section === "emergency" && (
        <>
          {header(t(language, "emergencyContact"))}
          <Body>{t(language, "emergencyDesc")}</Body>
          <View>
            <Label>{t(language, "contactName")}</Label>
            <TxtInput testID="set-contact-name" value={name} onChangeText={setName} />
          </View>
          <View>
            <Label>{t(language, "contactPhone")}</Label>
            <TxtInput testID="set-contact-phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </View>
          <Pressable testID="set-consent" onPress={() => setConsent(!consent)}>
            <Row><Icon name={consent ? "checkbox-marked" : "checkbox-blank-outline"} size={28} color={colors.brandPrimary} />
              <Body style={{ marginLeft: 10, flex: 1 }}>{t(language, "consentLabel")}</Body>
            </Row>
          </Pressable>
          <Caption>{t(language, "emergencyAlertNote")}</Caption>
          <Btn testID="set-contact-save" label={t(language, "save")} onPress={saveContact} />
          {contact && <Btn testID="set-contact-remove" variant="danger" label={t(language, "delete")} onPress={removeContact} />}
        </>
      )}

      {section === "privacy" && (
        <>
          {header(t(language, "privacy"))}
          <Card>
            <H3>Data stored on this device & server</H3>
            <Body style={{ marginTop: 8 }}>
              • Device key (random local id) {`\n`}• Medicines, schedules, dose records{`\n`}• Daily health notes{`\n`}• Emergency contact (if provided){`\n`}• Chat & scan logs for the assistant
            </Body>
            <Caption style={{ marginTop: 10 }}>
              Medicine images are sent to Google Gemini via Emergent for OCR only. We do not share with third parties. You can discontinue medicines; past dose history is preserved.
            </Caption>
          </Card>
        </>
      )}
    </ScrollView>
  );
}
