// app/order/OrderItemContent.js
import { notFound } from "next/navigation";
import { getMenuItem } from "../menu-data";
import CustomizeOrderItem from "./CustomizeOrderItem";

export default async function OrderItemContent({ params, modal = false }) {
  const { slug } = await params;
  const item = await getMenuItem(slug);

  if (!item) notFound();

  return <CustomizeOrderItem item={item} modal={modal} />;
}