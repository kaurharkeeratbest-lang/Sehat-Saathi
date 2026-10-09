import { Redirect } from "expo-router";
import { useAppState } from "@/src/store";

export default function Index() {
  const { onboarded } = useAppState();
  return <Redirect href={onboarded ? "/(tabs)" : "/onboarding"} />;
}
