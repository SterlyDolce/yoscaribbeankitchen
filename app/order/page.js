import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import MobileNav from "../MobileNav";
import { getMenuItems } from "../menu-data";
import { getUserForSessionToken, sessionCookieName } from "../session";
import OrderForm from "./OrderForm";

export const metadata = {
  title: "Order",
  description: "Build an online order request for Yo's Caribbean Kitchen."
};

export const dynamic = "force-dynamic";

export default async function OrderPage() {
  const cookieStore = await cookies();
  const [menuItems, user] = await Promise.all([
    getMenuItems(),
    getUserForSessionToken(cookieStore.get(sessionCookieName)?.value)
  ]);

  return (
    <main className="site inner-site">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Yo's Caribbean Kitchen home">
          <Image src="/yos-logo.png" alt="Yo's Caribbean Kitchen logo" width={96} height={64} priority />
          <span>Yo&apos;s Caribbean Kitchen</span>
        </Link>
        <MobileNav />
      </header>

      <OrderForm menuItems={menuItems} user={user} />
    </main>
  );
}
