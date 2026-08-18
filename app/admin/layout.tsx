import AdminLayout from '@/components/admin/AdminLayout';
import EnvironmentBanner from '@/components/admin/EnvironmentBanner';

export default function AdminAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Server component: reads the resolved environment directly, so the
          banner can never disagree with what the upload route actually uses. */}
      <EnvironmentBanner />
      <AdminLayout>{children}</AdminLayout>
    </>
  );
}
