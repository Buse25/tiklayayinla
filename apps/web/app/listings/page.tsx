import { Suspense } from 'react';
import { ListingsPage } from '../../src/components/listings/listings-page';

export default function ListingsRoute() {
  return (
    <Suspense fallback={<div className="p-md max-w-[1600px] mx-auto text-slate-900">Yükleniyor...</div>}>
      <ListingsPage />
    </Suspense>
  );
}
