// app/order/@modal/(.)[slug]/page.js
import OrderItemContent from "../../OrderItemContent";
import ModalCloseButton from "../../ModalCloseButton";

export default function OrderItemModal({ params }) {
  return (
    <div className="modal-backdrop">
      <ModalCloseButton />
      <div className="order-modal">
        <OrderItemContent params={params} modal />
      </div>
    </div>
  );
}
