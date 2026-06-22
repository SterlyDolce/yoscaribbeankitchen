import Image from "next/image";
import Link from "next/link";
import { ArrowRight, LogIn, ShoppingBag, UserPlus } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import MobileNav from "../MobileNav";
import { getUserForSessionToken, sessionCookieName } from "../session";

export const metadata = {
  title: "Checkout",
  description: "Choose how you want to continue your Yo's checkout."
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const cookieStore = await cookies();
  const user = await getUserForSessionToken(cookieStore.get(sessionCookieName)?.value);

  if (user) {
    redirect("/confirm-order");
  }

  return (
    <main className="site inner-site checkout-choice-site">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Yo's Caribbean Kitchen home">
          <Image src="/yos-logo.png" alt="Yo's Caribbean Kitchen logo" width={96} height={64} priority />
          <span>Yo&apos;s Caribbean Kitchen</span>
        </Link>
        <MobileNav />
      </header>

      <section className="checkout-choice-page">
        <div className="checkout-choice-heading">
          <p className="eyebrow">Checkout</p>
          <h1>Continue checkout</h1>
          <p>Use an account for saved details, or check out as a guest.</p>
        </div>

        <div className="checkout-choice-grid">
          <Link className="checkout-choice-card primary-choice" href="/auth?next=/confirm-order">
            <span>
              <LogIn size={24} />
            </span>
            <div>
              <h2>Log in</h2>
              <p>Saved profile, address, and balance.</p>
            </div>
            <b aria-label="Continue with login">
              <span>Continue</span>
              <ArrowRight size={18} />
            </b>
          </Link>

          <Link className="checkout-choice-card" href="/auth?mode=signup&next=/confirm-order">
            <span>
              <UserPlus size={24} />
            </span>
            <div>
              <h2>Create account</h2>
              <p>Save your info for next time.</p>
            </div>
            <b aria-label="Create an account">
              <span>Create</span>
              <ArrowRight size={18} />
            </b>
          </Link>

          <Link className="checkout-choice-card guest-choice" href="/confirm-order?guest=1">
            <span>
              <ShoppingBag size={24} />
            </span>
            <div>
              <h2>Continue as guest</h2>
              <p>Enter details for this order only.</p>
            </div>
            <b aria-label="Continue as guest">
              <span>Guest</span>
              <ArrowRight size={18} />
            </b>
          </Link>
        </div>
      </section>
    </main>
  );
}
