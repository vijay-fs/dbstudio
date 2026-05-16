import { redirect } from 'next/navigation';

export default async function ConnectionRoot(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  redirect(`/connections/${id}/schema`);
}
