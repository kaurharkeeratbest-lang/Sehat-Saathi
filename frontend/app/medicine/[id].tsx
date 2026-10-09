// Medicine detail — redirects to edit form which handles both.
import { useLocalSearchParams, Redirect } from "expo-router";

export default function MedicineDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/medicine/add?id=${id}`} />;
}
