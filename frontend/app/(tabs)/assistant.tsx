import React, { useState, useRef } from "react";
import { View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/material-design-icons";
import { Card, H2, Body, Caption, Row, TxtInput, Btn } from "@/src/ui";
import { colors, spacing, radius, fontSize } from "@/src/theme";
import { useAppState } from "@/src/store";
import { api } from "@/src/api";
import { t } from "@/src/i18n";

type Msg = { role: "user" | "assistant"; text: string };

export default function Assistant() {
  const insets = useSafeAreaInsets();
  const { language, deviceKey } = useAppState();
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", text: t(language, "assistantHello") + " " + t(language, "assistantAsk") }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await api.chat({ device_key: deviceKey, message: text, language, session_id: deviceKey });
      setMessages((m) => [...m, { role: "assistant", text: res.text }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", text: t(language, "errorNetwork") + " " + String(e?.message ?? "") }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  const quick = [
    { k: "today-sched", msg: language === "hi" ? "मुझे आज की दवाइयाँ बताओ" : "Tell me today's medicines" },
    { k: "next-med", msg: language === "hi" ? "अगली दवा कब है?" : "When is my next medicine?" },
    { k: "cal-colors", msg: language === "hi" ? "कैलेंडर के रंगों का क्या मतलब है?" : "What do the calendar colours mean?" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary, paddingTop: insets.top + spacing.md }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <H2>{t(language, "tabAssistant")}</H2>
        <Caption>{t(language, "assistantAsk")}</Caption>
      </View>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: 24 }}>
        {messages.map((m, i) => (
          <View key={i} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "88%",
            backgroundColor: m.role === "user" ? colors.brandPrimary : colors.surface,
            borderRadius: radius.lg,
            padding: spacing.md,
            borderWidth: m.role === "user" ? 0 : 1,
            borderColor: colors.border,
          }}>
            <Body style={{ color: m.role === "user" ? colors.onBrandPrimary : colors.onSurface }}>{m.text}</Body>
          </View>
        ))}
        {loading && <ActivityIndicator color={colors.brandPrimary} />}
      </ScrollView>
      <View style={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm }}>
        <Row style={{ gap: spacing.sm, flexWrap: "wrap" }}>
          {quick.map((q) => (
            <Pressable key={q.k} testID={`quick-${q.k}`} onPress={() => send(q.msg)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.brandTertiary }}>
              <Caption style={{ color: colors.onBrandTertiary, fontWeight: "700" }}>{q.msg}</Caption>
            </Pressable>
          ))}
        </Row>
        <Row style={{ gap: 8 }}>
          <TxtInput testID="assistant-input" placeholder={t(language, "typeMessage")} value={input} onChangeText={setInput} style={{ flex: 1 }} />
          <Pressable testID="assistant-send" onPress={() => send()} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}>
            <Icon name="send" size={24} color={colors.onBrandPrimary} />
          </Pressable>
        </Row>
      </View>
    </View>
  );
}
