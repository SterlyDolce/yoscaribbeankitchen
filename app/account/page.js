import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowRight, Clock3, CreditCard, MapPin, Phone, ReceiptText, ShoppingBag, Truck, UserRound } from "lucide-react";
import MobileNav from "../MobileNav";
import { query } from "../db";
import { ensureOrderPaymentTracking } from "../order/payment-schema";
import { getUserForSessionToken, sessionCookieName } from "../session";
import AddressForm from "./AddressForm";
import SignOutButton from "./SignOutButton";

export const metadata = {
  title: "Account",
  description: "Manage your Yo's Caribbean Kitchen account and order requests."
};

export const dynamic = "force-dynamic";

const formatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency"
});

function formatOrderStatus(status) {
  if (!status) return "unknown";

  if (status === "in_route") {
    return "In route";
  }

  return status.replace(/_/g, " ");
}

function formatUserAddress(user) {
  if (!user.addressLine1 || !user.city || !user.state || !user.postalCode) {
    return null;
  }

  return [
    user.addressLine1,
    user.addressLine2,
    `${user.city}, ${user.state} ${user.postalCode}`
  ].filter(Boolean);
}

async function getRecentOrders(userId) {
  await ensureOrderPaymentTracking();

  const ordersResult = await query(
    `select id, fulfillment_method, payment_preference, payment_status, delivery_address, status, total, created_at
     from public.orders
     where user_id = $1
     order by created_at desc
     limit 8`,
    [userId]
  );
  const orders = ordersResult.rows;

  if (orders.length === 0) {
    return [];
  }

  const itemsResult = await query(
    `select order_id, item_name, special_instructions, quantity, line_total
     from public.order_items
     where order_id = any($1::uuid[])
     order by created_at asc`,
    [orders.map((order) => order.id)]
  );
  const itemsByOrderId = new Map();

  for (const item of itemsResult.rows) {
    const currentItems = itemsByOrderId.get(item.order_id) || [];
    currentItems.push({
      lineTotal: item.line_total,
      name: item.item_name,
      instructions: item.special_instructions,
      quantity: item.quantity
    });
    itemsByOrderId.set(item.order_id, currentItems);
  }

  return orders.map((order) => ({
    ...order,
    items: itemsByOrderId.get(order.id) || []
  }));
}

export default async function AccountPage() {
  const cookieStore = await cookies();
  const user = await getUserForSessionToken(cookieStore.get(sessionCookieName)?.value);

  if (!user) {
    redirect("/auth");
  }

  const orders = await getRecentOrders(user.id);
  const addressLines = formatUserAddress(user);
  const firstName = user.fullName.split(" ")[0];
  const latestOrder = orders[0];

  return (
    <main className="site inner-site account-site">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Yo's Caribbean Kitchen home">
          <Image src="/yos-logo.png" alt="Yo's Caribbean Kitchen logo" width={96} height={64} priority />
          <span>Yo&apos;s Caribbean Kitchen</span>
        </Link>
        <MobileNav />
      </header>

      <section className="page-hero account-page-hero">
        <div>
          <p className="eyebrow">Account</p>
          <h1>{firstName}&apos;s account.</h1>
          <p>Keep delivery details ready and follow recent Yo&apos;s order requests from one place.</p>
        </div>
        <div className="account-hero-card">
          <span>Recent orders</span>
          <strong>{orders.length}</strong>
          <small>{latestOrder ? `Last order ${formatter.format(Number(latestOrder.total))}` : "No orders yet"}</small>
        </div>
      </section>

      <section className="account-layout">
        <aside className="account-panel">
          <div className="profile-card-top">
            <div className="profile-avatar" aria-hidden="true">
              {firstName.charAt(0)}
            </div>
            <div className="profile-title">
              <p className="eyebrow">Profile</p>
              <h2>{user.fullName}</h2>
            </div>
          </div>

          <div className="profile-contact">
            <span>
              <UserRound size={17} />
              {user.email}
            </span>
            {user.phone && (
              <span>
                <Phone size={17} />
                {user.phone}
              </span>
            )}
          </div>
          {addressLines ? (
            <div className="profile-address">
              <strong><MapPin size={17} /> Delivery address</strong>
              {addressLines.map((line) => <span key={line}>{line}</span>)}
              {user.deliveryNotes && <small>{user.deliveryNotes}</small>}
            </div>
          ) : (
            <p className="profile-alert">Add an address before choosing delivery.</p>
          )}
          <div className="account-panel-actions">
            <Link href="/menu">
              Start order
              <ArrowRight size={18} />
            </Link>
            <SignOutButton />
          </div>
        </aside>

        <div className="account-main">
          <section className="profile-panel">
            <AddressForm user={user} />
          </section>

          <section className="orders-panel">
            <div className="orders-heading">
              <div>
                <p className="eyebrow">Order History</p>
                <h2>Recent requests</h2>
              </div>
              <div className="orders-count">
                <ReceiptText size={22} />
                <strong>{orders.length}</strong>
              </div>
            </div>

            {orders.length === 0 ? (
              <div className="empty-orders">
                <p>No order requests yet.</p>
                <Link href="/menu">Build your first order</Link>
              </div>
            ) : (
              <div className="order-history">
                {orders.map((order) => (
                  <article key={order.id}>
                    <div className="order-history-top">
                      <div>
                        <strong>Order {order.id.slice(0, 8)}</strong>
                        <span>{new Date(order.created_at).toLocaleString()}</span>
                      </div>
                      <b>{formatter.format(Number(order.total))}</b>
                    </div>
                    <div className="order-meta-row">
	                      <span><Truck size={14} />{order.fulfillment_method}</span>
	                      <span><CreditCard size={14} />{order.payment_preference} · {formatOrderStatus(order.payment_status)}</span>
	                      <span><Clock3 size={14} />{formatOrderStatus(order.status)}</span>
                    </div>
                    {order.delivery_address && <p className="order-address">{order.delivery_address}</p>}
                    <ul>
                      {order.items.map((item, index) => (
                        <li key={`${order.id}-${item.name}-${index}`}>
                          <span><ShoppingBag size={14} />{item.quantity} x {item.name}</span>
                          {item.instructions && <small>{item.instructions}</small>}
                          <strong>{formatter.format(Number(item.lineTotal))}</strong>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
