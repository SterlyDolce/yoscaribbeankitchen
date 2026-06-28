import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock3, CreditCard, MapPin, ShoppingBag, Truck } from "lucide-react";
import { ensureAccountBalanceSchema } from "../../account-balance-schema";
import MobileNav from "../../MobileNav";
import { query } from "../../db";
import { ensureOrderPaymentTracking } from "../../order/payment-schema";
import { getUserForSessionToken, sessionCookieName } from "../../session";
import OrderProgressTracker from "./OrderProgressTracker";

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

async function getOrder(orderId, userId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
    return null;
  }

  await ensureOrderPaymentTracking();
  await ensureAccountBalanceSchema();

  const orderResult = await query(
    `select
       id,
       fulfillment_method,
       payment_preference,
       payment_status,
       delivery_address,
       ready_time,
       status,
       subtotal,
       tax,
       account_balance_applied,
       total,
       created_at
     from public.orders
     where id = $1 and user_id = $2
     limit 1`,
    [orderId, userId]
  );

  const order = orderResult.rows[0];
  if (!order) return null;

  const itemsResult = await query(
    `select
       oi.item_name,
       oi.special_instructions,
       oi.quantity,
       oi.unit_price,
       oi.line_total,
       coalesce(mi.image, '/yos-logo.png') as image
     from public.order_items oi
     left join public.menu_items mi on mi.slug = oi.menu_item_slug
     where oi.order_id = $1
     order by oi.created_at asc`,
    [order.id]
  );

  return {
    ...order,
    items: itemsResult.rows.map((item) => ({
      image: item.image,
      instructions: item.special_instructions,
      lineTotal: Number(item.line_total),
      name: item.item_name,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price)
    }))
  };
}

export async function generateMetadata({ params }) {
  const { id } = await params;

  return {
    title: `Order ${id.slice(0, 8)}`,
    description: "View your Yo's Caribbean Kitchen order details."
  };
}

export default async function OrderDetailsPage({ params }) {
  const [{ id }, cookieStore] = await Promise.all([params, cookies()]);
  const user = await getUserForSessionToken(cookieStore.get(sessionCookieName)?.value);

  if (!user) {
    redirect("/auth");
  }

  const order = await getOrder(id, user.id);

  if (!order) {
    notFound();
  }

  return (
    <main className="site inner-site account-site">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Yo's Caribbean Kitchen home">
          <Image src="/yos-logo.png" alt="Yo's Caribbean Kitchen logo" width={96} height={64} priority />
          <span>Yo&apos;s Caribbean Kitchen</span>
        </Link>
        <MobileNav />
      </header>

      <section className="order-detail-layout">
        <Link className="order-detail-back" href="/account">
          <ArrowLeft size={18} />
          Back to account
        </Link>

        <div className="order-detail-card">
          <div className="order-detail-heading">
            <div>
              <p className="eyebrow">Order Details</p>
              <h1>Order {order.id.slice(0, 8)}</h1>
              <span>{new Date(order.created_at).toLocaleString()}</span>
            </div>
            <strong>{formatter.format(Number(order.total))}</strong>
          </div>

          <div className="order-detail-meta">
            <span><Truck size={16} />{order.fulfillment_method}</span>
            <span><CreditCard size={16} />{order.payment_preference} · {formatOrderStatus(order.payment_status)}</span>
            <span><Clock3 size={16} />{formatOrderStatus(order.status)}</span>
          </div>

          <OrderProgressTracker
            initialReadyTime={order.ready_time || ""}
            initialStatus={order.status}
            orderId={order.id}
          />

          {order.delivery_address && (
            <div className="order-detail-address">
              <MapPin size={18} />
              <p>{order.delivery_address}</p>
            </div>
          )}

          <div className="order-detail-items">
            <h2>Items</h2>
            {order.items.map((item, index) => (
              <div className="order-detail-item" key={`${order.id}-${item.name}-${index}`}>
                <Image src={item.image} alt={item.name} width={76} height={76} />
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.quantity} x {formatter.format(item.unitPrice)}</span>
                  {item.instructions && <small>{item.instructions}</small>}
                  <b>{formatter.format(item.lineTotal)}</b>
                </div>
                
              </div>
            ))}
          </div>

      <div className="order-detail-totals">
            <span>Subtotal<strong>{formatter.format(Number(order.subtotal))}</strong></span>
            <span>Tax<strong>{formatter.format(Number(order.tax))}</strong></span>
            {Number(order.account_balance_applied) > 0 && (
              <span>Back Balance<strong>{formatter.format(Number(order.account_balance_applied))}</strong></span>
            )}
            <span>Total<strong>{formatter.format(Number(order.total))}</strong></span>
          </div>

          <Link className="order-detail-action" href="/menu">
            <ShoppingBag size={18} />
            Order again
          </Link>
        </div>
      </section>
    </main>
  );
}
