import OrderItemContent from "../../../order/OrderItemContent";
import ModalCloseButton from "../../../order/ModalCloseButton";

export default function MenuItemModal({ params }) {
  return (
    <div className="modal-backdrop">
      <ModalCloseButton />
      <div className="order-modal">
        <OrderItemContent params={params} modal />
      </div>
    </div>
  );
}
