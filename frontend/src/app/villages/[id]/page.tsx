import VillageDetail from "@/components/village-detail";

export default async function VillageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VillageDetail villageId={id} />;
}
