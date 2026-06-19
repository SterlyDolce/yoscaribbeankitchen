function cleanText(value, maxLength = 120) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanEmail(value) {
  return cleanText(value, 180).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeGuestContact(value = {}) {
  const contact = {
    addressLine1: cleanText(value.addressLine1),
    addressLine2: cleanText(value.addressLine2),
    city: cleanText(value.city),
    deliveryNotes: cleanText(value.deliveryNotes, 240),
    email: cleanEmail(value.email),
    fullName: cleanText(value.fullName),
    phone: cleanText(value.phone, 40),
    postalCode: cleanText(value.postalCode, 30),
    state: cleanText(value.state, 40)
  };

  return contact;
}

export function validateCustomer(user, guestContact, fulfillmentMethod) {
  if (user) {
    return { customer: user, guestContact: null, message: null, valid: true };
  }

  if (!guestContact.fullName) {
    return { message: "Enter your name to continue as a guest.", valid: false };
  }

  if (!isValidEmail(guestContact.email)) {
    return { message: "Enter a valid email for your order receipt.", valid: false };
  }

  if (!guestContact.phone) {
    return { message: "Enter a phone number so Yo's can contact you about the order.", valid: false };
  }

  if (fulfillmentMethod === "Delivery" && !formatDeliveryAddress(guestContact)) {
    return { message: "Enter a full delivery address.", valid: false };
  }

  return { customer: guestContact, guestContact, message: null, valid: true };
}

export function formatDeliveryAddress(customer) {
  if (!customer.addressLine1 || !customer.city || !customer.state || !customer.postalCode) {
    return null;
  }

  return [
    customer.addressLine1,
    customer.addressLine2,
    `${customer.city}, ${customer.state} ${customer.postalCode}`,
    customer.deliveryNotes ? `Notes: ${customer.deliveryNotes}` : null
  ].filter(Boolean).join("\n");
}
