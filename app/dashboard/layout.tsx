import { DashboardNav } from "@/components/dashboard/DashboardNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream">
      <DashboardNav />
      <main className="content-wrap py-8">{children}</main>
    </div>
  );
}
