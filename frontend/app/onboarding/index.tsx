// Combined onboarding flow: welcome → language → voice → notifications → emergency.
import React, { useState } from "react";
import { View, ScrollView, Pressable, Text, Switch, FlatList, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { Btn, Card, GradientBg, H1, H2, Body, Caption, Label, TxtInput, Row, H3 } from "@/src/ui";
import { colors, spacing, radius, fontSize } from "@/src/theme";
import { LANGUAGES, t, applyRTL } from "@/src/i18n";
import { useAppState } from "@/src/store";
import { api } from "@/src/api";

type Step = "welcome" | "language" | "voice" | "notifications" | "emergency";

export default function Onboarding() {
  const [step, setStep] = useState<Step>("welcome");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language, setLanguage, voiceEnabled, setVoiceEnabled, setOnboarded, deviceKey } = useAppState();
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [notifStatus, setNotifStatus] = useState<"idle" | "granted" | "denied">("idle");

  const next = (s: Step) => setStep(s);
  const finish = async () => {
    await setOnboarded(true);
    router.replace("/(tabs)");
  };

  const requestNotif = async () => {
    try {
      // Lazy require: expo-notifications' remote push module is removed from Expo Go (SDK 53+).
      // Local scheduled notifications still work in a dev/production build.
      const Notifications = require("expo-notifications");
      const res = await Notifications.requestPermissionsAsync();
      setNotifStatus(res.granted || res.ios?.status === 3 ? "granted" : "denied");
    } catch {
      setNotifStatus("denied");
    }
  };

  const saveContact = async () => {
    if (!contactName.trim() || !contactPhone.trim() || !consent) return finish();
    try {
      await api.setContact({
        device_key: deviceKey,
        name: contactName.trim(),
        phone: contactPhone.trim(),
        language,
        consent,
        enabled: true,
      });
    } catch (e: any) {
      Alert.alert(t(language, "errorSave"), String(e.message || e));
      return;
    }
    finish();
  };

  return (
    <GradientBg variant="cloud">
      <View style={{ flex: 1, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md }}>
        {step === "welcome" && (
          <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, justifyContent: "center" }}>
            <View style={{ alignItems: "center", gap: spacing.md }}>
              <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
                <Icon name="pill" size={64} color={colors.brandPrimary} />
              </View>
              <H1 style={{ textAlign: "center", color: colors.brandPrimary }}>{t(language, "appName")}</H1>
              <Caption style={{ textAlign: "center", fontSize: fontSize.base, color: colors.info }}>
                {t(language, "tagline")}
              </Caption>
              <Body style={{ textAlign: "center", marginTop: spacing.md }}>{t(language, "welcomeIntro")}</Body>
            </View>
            <Btn testID="onboard-start-btn" style={{ marginTop: spacing.xl }} label={t(language, "start")} onPress={() => next("language")} />
          </ScrollView>
        )}

        {step === "language" && (
          <View style={{ flex: 1, padding: spacing.lg }}>
            <H2>{t(language, "chooseLanguage")}</H2>
            <Caption style={{ marginTop: 6 }}>{t(language, "languageNote")}</Caption>
            <FlatList
              data={LANGUAGES}
              keyExtractor={(l) => l.code}
              style={{ marginTop: spacing.md }}
              renderItem={({ item }) => (
                <Pressable
                  testID={`lang-${item.code}`}
                  onPress={async () => { await setLanguage(item.code); applyRTL(item.code); }}
                  style={{
                    padding: spacing.md,
                    borderRadius: radius.md,
                    borderWidth: 1.5,
                    borderColor: language === item.code ? colors.brandPrimary : colors.border,
                    backgroundColor: language === item.code ? colors.brandTertiary : colors.surface,
                    marginBottom: 10,
                    minHeight: 64,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface }}>{item.native}</Text>
                    <Text style={{ fontSize: fontSize.sm, color: colors.muted }}>{item.english}{item.validated ? "" : "  •  limited"}</Text>
                  </View>
                  {language === item.code && <Icon name="check-circle" size={28} color={colors.brandPrimary} />}
                </Pressable>
              )}
            />
            <Btn testID="lang-continue-btn" label={t(language, "continue")} onPress={() => next("voice")} />
          </View>
        )}

        {step === "voice" && (
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
            <H2>{t(language, "voicePrefTitle")}</H2>
            <Body>{t(language, "voicePrefDesc")}</Body>
            <Card>
              <Row style={{ justifyContent: "space-between" }}>
                <Text style={{ fontSize: fontSize.base, fontWeight: "600", color: colors.onSurface, flex: 1 }}>
                  {t(language, "enableAssistant")}
                </Text>
                <Switch testID="voice-switch" value={voiceEnabled} onValueChange={setVoiceEnabled} />
              </Row>
            </Card>
            <Caption>{t(language, "partialTranslation")}</Caption>
            <Btn testID="voice-continue-btn" label={t(language, "continue")} onPress={() => next("notifications")} />
          </ScrollView>
        )}

        {step === "notifications" && (
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
            <H2>{t(language, "notifTitle")}</H2>
            <Body>{t(language, "notifDesc")}</Body>
            {notifStatus === "denied" && <Caption style={{ color: colors.warning }}>{t(language, "notifDenied")}</Caption>}
            <Btn testID="notif-allow-btn" label={t(language, "allow")} onPress={requestNotif} />
            <Btn
              testID="notif-continue-btn"
              variant="ghost"
              label={notifStatus === "granted" ? t(language, "continue") : t(language, "skip")}
              onPress={() => next("emergency")}
            />
          </ScrollView>
        )}

        {step === "emergency" && (
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
            <H2>{t(language, "emergencyTitle")}</H2>
            <Body>{t(language, "emergencyDesc")}</Body>
            <View>
              <Label>{t(language, "contactName")}</Label>
              <TxtInput testID="contact-name-input" value={contactName} onChangeText={setContactName} />
            </View>
            <View>
              <Label>{t(language, "contactPhone")}</Label>
              <TxtInput testID="contact-phone-input" value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />
            </View>
            <Pressable testID="consent-row" onPress={() => setConsent(!consent)}>
              <Row>
                <Icon name={consent ? "checkbox-marked" : "checkbox-blank-outline"} size={28} color={colors.brandPrimary} />
                <Text style={{ fontSize: fontSize.base, color: colors.onSurface, marginLeft: 10, flex: 1 }}>
                  {t(language, "consentLabel")}
                </Text>
              </Row>
            </Pressable>
            <Caption>{t(language, "emergencyAlertNote")}</Caption>
            <Btn testID="emergency-save-btn" label={t(language, "save")} onPress={saveContact} />
            <Btn testID="emergency-skip-btn" variant="ghost" label={t(language, "skip")} onPress={finish} />
          </ScrollView>
        )}
      </View>
    </GradientBg>
  );
}
