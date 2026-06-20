import OrderItemContent from "../../../order/OrderItemContent";

export default function MenuItemModal({ params }) {
  return (
    <div className="modal-backdrop">
      <div className="order-modal">
        <OrderItemContent params={params} modal />
      </div>
    </div>
  );
}
