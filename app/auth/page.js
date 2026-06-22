import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import MobileNav from "../MobileNav";
import { getUserForSessionToken, sessionCookieName } from "../session";
import AuthForm from "./AuthForm";

export const metadata = {
  title: "Sign In",
  description: "Sign in or create a Yo's Caribbean Kitchen account to continue your order."
};

export const dynamic = "force-dynamic";

function getSafeRedirectPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/account";
  }

  return value;
}

export default async function AuthPage({ searchParams }) {
  const params = await searchParams;
  const next = getSafeRedirectPath(params?.next);
  const mode = params?.mode === "signup" ? "signup" : "signin";
  const cookieStore = await cookies();
  const user = await getUserForSessionToken(cookieStore.get(sessionCookieName)?.value);

  if (user) {
    redirect(next);
  }

  return (
    <main className="site inner-site auth-site">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Yo's Caribbean Kitchen home">
          <Image src="/yos-logo.png" alt="Yo's Caribbean Kitchen logo" width={96} height={64} priority />
          <span>Yo&apos;s Caribbean Kitchen</span>
        </Link>
        <MobileNav />
      </header>

      <section className="auth-layout">
        <div className="auth-brand-panel">
          <Image src="/yos-logo.png" alt="" width={520} height={347} priority />
          <p className="eyebrow">Account Access</p>
          <p>Save your profile and track order requests.</p>
        </div>
        <AuthForm initialMode={mode} next={next} />
      </section>
    </main>
  );
}
