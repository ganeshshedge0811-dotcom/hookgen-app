import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";

export async function POST(request: NextRequest) {
  // ── Parse & validate body ────────────────────────────────
  let body: { amount?: number };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const amount = body.amount;

  if (!amount || typeof amount !== "number" || amount <= 0) {
    return NextResponse.json(
      { error: "Missing or invalid field: amount (must be a positive number in paise)." },
      { status: 400 }
    );
  }

  // ── Validate env vars ────────────────────────────────────
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    console.error("RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not set.");
    return NextResponse.json(
      { error: "Server configuration error. Please try again later." },
      { status: 500 }
    );
  }

  // ── Create Razorpay order ────────────────────────────────
  try {
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `hookgen_${Date.now()}`,
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId, // public key — safe to send to client for checkout
    });
  } catch (err) {
    console.error("Razorpay order creation error:", err);
    return NextResponse.json(
      { error: "Failed to create payment order. Please try again." },
      { status: 500 }
    );
  }
}
