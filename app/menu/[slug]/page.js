import Image from "next/image";
import Link from "next/link";
import MobileNav from "../../MobileNav";
import OrderItemContent from "../../order/OrderItemContent";

export default function MenuItemPage({ params }) {
  return (
    <main className="site inner-site">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Yo's Caribbean Kitchen home">
          <Image src="/yos-logo.png" alt="Yo's Caribbean Kitchen logo" width={96} height={64} priority />
          <span>Yo&apos;s Caribbean Kitchen</span>
        </Link>
        <MobileNav />
      </header>

      <OrderItemContent params={params} />
    </main>
  );
}
