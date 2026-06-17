// app/order/@modal/(.)[slug]/page.js
import OrderItemContent from "../../OrderItemContent";

export default function OrderItemModal({ params }) {
  return (
    <div className="modal-backdrop">
      <div className="order-modal">
        <OrderItemContent params={params} modal />
      </div>
    </div>
  );
}