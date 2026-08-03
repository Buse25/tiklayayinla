export function AuthErrorMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"><span className="material-symbols-rounded text-[19px]">error</span><span>{message}</span></div>;
}
