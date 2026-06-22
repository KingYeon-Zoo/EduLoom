import DashboardShell from '@/components/layout/DashboardShell'

export default function FeatureLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardShell>{children}</DashboardShell>
}
