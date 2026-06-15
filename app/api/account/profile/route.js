import { NextResponse } from "next/server";
import { hasDatabaseConfig, query } from "../../../db";
import { getUserForSessionToken, sessionCookieName } from "../../../session";

function clean(value) {
  const normalized = String(value || "").trim();
  return normalized.length > 0 ? normalized : null;
}

export async function PATCH(request) {
  if (!hasDatabaseConfig()) {
    return NextResponse.json({ message: "Database is not configured." }, { status: 503 });
  }

  const user = await getUserForSessionToken(request.cookies.get(sessionCookieName)?.value);

  if (!user) {
    return NextResponse.json({ message: "Sign in to update your profile." }, { status: 401 });
  }

  const body = await request.json();
  const addressLine1 = clean(body.addressLine1);
  const addressLine2 = clean(body.addressLine2);
  const city = clean(body.city);
  const state = clean(body.state);
  const postalCode = clean(body.postalCode);
  const deliveryNotes = clean(body.deliveryNotes);

  if (!addressLine1 || !city || !state || !postalCode) {
    return NextResponse.json(
      { message: "Address, city, state, and ZIP code are required for delivery." },
      { status: 400 }
    );
  }

  const result = await query(
    `update public.users
     set address_line1 = $1,
         address_line2 = $2,
         city = $3,
         state = $4,
         postal_code = $5,
         delivery_notes = $6
     where id = $7
     returning id, full_name, email, phone, role, address_line1, address_line2, city, state, postal_code, delivery_notes`,
    [addressLine1, addressLine2, city, state, postalCode, deliveryNotes, user.id]
  );

  const updatedUser = result.rows[0];

  return NextResponse.json({
    user: {
      addressLine1: updatedUser.address_line1,
      addressLine2: updatedUser.address_line2,
      city: updatedUser.city,
      deliveryNotes: updatedUser.delivery_notes,
      email: updatedUser.email,
      fullName: updatedUser.full_name,
      id: updatedUser.id,
      phone: updatedUser.phone,
      postalCode: updatedUser.postal_code,
      role: updatedUser.role,
      state: updatedUser.state
    }
  });
}
