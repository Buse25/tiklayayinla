import { AdminUserDetailPage } from '../../../../src/components/admin/admin-user-detail-page';

export default function Page({ params }: { params: { id: string } }) {
  return <AdminUserDetailPage id={params.id} />;
}
