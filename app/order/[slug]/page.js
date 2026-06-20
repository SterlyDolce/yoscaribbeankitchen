import { redirect } from "next/navigation";

export default async function OrderItemPage({ params }) {
  const { slug } = await params;
  redirect(`/menu/${slug}`);
}
