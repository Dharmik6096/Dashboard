import { Metadata } from "next"
import { DockerDashboard } from "@/components/docker/DockerDashboard"

export const metadata: Metadata = {
  title: "Docker | DevOps Monitor",
  description: "Container inventory, runtime health, image usage, resource trends, and Docker engine visibility across your servers.",
}

export default function DockerPage() {
  return (
    <div className="flex h-full flex-col">
      <DockerDashboard />
    </div>
  )
}
