import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import MobileNav from "../../MobileNav";
import { getMenuItem } from "../../menu-data";
import CustomizeOrderItem from "./CustomizeOrderItem";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const item = await getMenuItem(slug);

  return item
    ? { title: `Order ${item.name}`, description: item.details }
    : { title: "Menu item unavailable" };
}

export default async function OrderItemPage({ params }) {
  const { slug } = await params;
  const item = await getMenuItem(slug);

  if (!item) {
    notFound();
  }

  return (
    <main className="site inner-site">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Yo's Caribbean Kitchen home">
          <Image src="/yos-logo.png" alt="Yo's Caribbean Kitchen logo" width={96} height={64} priority />
          <span>Yo&apos;s Caribbean Kitchen</span>
        </Link>
        <MobileNav />
      </header>

      <CustomizeOrderItem item={item} />
    </main>
  );
}
