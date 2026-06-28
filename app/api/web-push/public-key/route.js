import { NextResponse } from "next/server";
import { getCustomerWebPushPublicKey } from "../../../customer-notifications";

export function GET() {
  const publicKey = getCustomerWebPushPublicKey();

  return NextResponse.json({
    enabled: Boolean(publicKey),
    publicKey
  });
}
