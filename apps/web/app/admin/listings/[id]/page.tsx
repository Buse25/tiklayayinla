import { AdminListingDetailPage } from '../../../../src/components/admin/admin-listing-detail-page';
export default function Page({ params }: { params: { id: string } }) { return <AdminListingDetailPage id={params.id} />; }
