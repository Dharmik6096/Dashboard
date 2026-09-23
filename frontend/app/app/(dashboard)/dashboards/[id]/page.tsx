import { DashboardEditor } from "@/components/dashboards/DashboardEditor";

export default async function DashboardEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DashboardEditor dashboardId={id} />;
}
