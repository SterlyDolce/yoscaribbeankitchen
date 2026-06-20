"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  formatMenuItemSelections,
  getMenuItemCustomization,
  getMenuItemUnitPrice,
  requiresMealOptions
} from "../menu-customizations";
import { addToOrderBag, openOrderBag } from "./order-bag";

const formatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency"
});

export default function CustomizeOrderItem({ item, modal = false }) {
  const router = useRouter();

  const [quantity, setQuantity] = useState(1);
  const [instructions, setInstructions] = useState("");
  const [added, setAdded] = useState(false);
  const [buttonAdded, setButtonAdded] = useState(false);
  const buttonResetTimer = useRef(null);

  const customization = getMenuItemCustomization(item);
  const [selections, setSelections] = useState({});

  const optionsReady =
    !requiresMealOptions(item) ||
    Boolean(
      customization?.groups.length &&
      customization.groups.every((group) => group.options.length >= group.min)
    );

  const selectionsComplete =
    optionsReady &&
    (!customization ||
      customization.groups.every((group) => {
        const count = selections[group.id]?.length || 0;
        return count >= group.min && count <= group.max;
      }));

  const unitPrice = getMenuItemUnitPrice(item, selections);

  useEffect(() => {
    return () => {
      if (buttonResetTimer.current) {
        window.clearTimeout(buttonResetTimer.current);
      }
    };
  }, []);

  function resetAddedState() {
    if (buttonResetTimer.current) {
      window.clearTimeout(buttonResetTimer.current);
    }

    setAdded(false);
    setButtonAdded(false);
  }

  function toggleSelection(group, optionId) {
    setSelections((current) => {
      const selected = current[group.id] || [];

      const next = selected.includes(optionId)
        ? selected.filter((id) => id !== optionId)
        : selected.length < group.max
          ? [...selected, optionId]
          : selected;

      return {
        ...current,
        [group.id]: next
      };
    });

    resetAddedState();
  }

  function addItem() {
    if (!selectionsComplete) return;

    addToOrderBag({
      instructions,
      quantity,
      selections,
      slug: item.slug
    });

    if (buttonResetTimer.current) {
      window.clearTimeout(buttonResetTimer.current);
    }

    setAdded(true);
    setButtonAdded(false);

    window.requestAnimationFrame(() => {
      setButtonAdded(true);
      buttonResetTimer.current = window.setTimeout(() => {
        setButtonAdded(false);
      }, 650);
    });
  }

  return (
    <section
      className={
        modal
          ? "customize-order-page modal-version"
          : "customize-order-page"
      }
    >
      {modal ? (
        <button
          className="modal-customize-back-link"
          onClick={() => router.back()}
          type="button"
        >
          <X size={18} color="black" />
        </button>
      ) : (
        <Link className="customize-back-link" href="/menu">
          <ArrowLeft size={18} />
          Back to menu
        </Link>
      )}

      <div className="customize-order-card">
        <div className="customize-order-image">
          <img src={item.image} alt={item.name} />
        </div>

        <div className="customize-order-copy">
          <p className="eyebrow">{item.tag}</p>

          <h1>{item.name}</h1>

          <p className="creole-name">{item.nameInCreole}</p>

          <p className="customize-order-details">
            {item.details}
          </p>

          <strong className="customize-order-price">
            {formatter.format(item.price)}
          </strong>

          <div className="customize-fields">
            {!optionsReady && (
              <div
                className="meal-options-unavailable"
                role="status"
              >
                <strong>Meal choices are coming soon.</strong>
                <span>
                  Sides and sauces have not been added for
                  this meal yet.
                </span>
              </div>
            )}

            {customization?.groups.map((group) => (
              <fieldset
                className="meal-option-group"
                key={group.id}
              >
                <legend>
                  {group.label}

                  <small>
                    {selections[group.id]?.length || 0}/
                    {group.max} selected
                  </small>
                </legend>

                <div className="meal-option-grid">
                  {group.options.map((option) => {
                    const checked =
                      selections[group.id]?.includes(
                        option.id
                      ) || false;

                    const disabled =
                      !checked &&
                      (selections[group.id]?.length || 0) >=
                        group.max;

                    return (
                      <label
                        className={checked ? "selected" : ""}
                        key={option.id}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() =>
                            toggleSelection(
                              group,
                              option.id
                            )
                          }
                        />

                        <span>
                          {option.label}

                          {option.priceAdjustment !== 0 && (
                            <small>
                              +
                              {formatter.format(
                                option.priceAdjustment
                              )}
                            </small>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            <div>
              <span className="customize-label">
                Quantity
              </span>

              <div
                className="quantity-control customize-quantity"
                aria-label={`${item.name} quantity`}
              >
                <button
                  type="button"
                  disabled={quantity === 1}
                  onClick={() => {
                    resetAddedState();
                    setQuantity((value) =>
                      Math.max(1, value - 1)
                    );
                  }}
                >
                  <Minus size={18} />
                </button>

                <strong>{quantity}</strong>

                <button
                  type="button"
                  onClick={() => {
                    resetAddedState();
                    setQuantity((value) => value + 1);
                  }}
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            <label className="customize-instructions">
              <span className="customize-label">
                Special instructions
              </span>

              <textarea
                rows={4}
                maxLength={300}
                value={instructions}
                placeholder="Allergies, preparation notes, or requests..."
                onChange={(event) => {
                  setInstructions(event.target.value);
                  resetAddedState();
                }}
              />

              <small>{instructions.length}/300</small>
            </label>
          </div>

          {customization && selectionsComplete && (
            <p className="meal-selection-summary">
              {formatMenuItemSelections(
                item,
                selections
              )}
            </p>
          )}

          <button
            className={buttonAdded ? "add-to-bag-button is-added" : "add-to-bag-button"}
            type="button"
            disabled={!selectionsComplete}
            onClick={addItem}
          >
            <ShoppingBag size={19} />

            {buttonAdded
              ? "Added to bag"
              : selectionsComplete
              ? `Add ${quantity} to bag · ${formatter.format(
                  unitPrice * quantity
                )}`
              : optionsReady
                ? "Complete your meal choices"
                : "Meal options coming soon"}
          </button>

          {added && (
            <div
              className="bag-added-message"
              role="status"
            >
              Added to your bag.

              <button onClick={openOrderBag} type="button">
                Review bag
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
