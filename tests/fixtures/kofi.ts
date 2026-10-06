/**
 * @file tests/fixtures/kofi.ts
 * @desc Ko-fi webhook payloads shaped like the ones Evergreen Cup receives. The token is fake.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

export const KOFI_TOKEN = "00000000-test-token-not-real";

export const kofiPayload = {
  verification_token: KOFI_TOKEN,
  message_id: "3a1fac0c-f960-4506-a60e-824979a74e74",
  timestamp: "2026-04-23T12:00:00Z",
  type: "Donation",
  is_public: true,
  from_name: "Cityyy",
  message: "love this",
  amount: "25.00",
  url: "https://ko-fi.com/Home/CoffeeShop?txid=00000000-1111-2222-3333-444444444444",
  email: "donor@example.com",
  currency: "USD",
  is_subscription_payment: false,
  is_first_subscription_payment: false,
  kofi_transaction_id: "00000000-1111-2222-3333-444444444444",
  shop_items: null,
  tier_name: null,
  shipping: null,
};

/** The body Ko-fi posts: form-encoded, one `data` field holding the JSON. */
export const kofiBody = (data: unknown): string =>
  new URLSearchParams({ data: JSON.stringify(data) }).toString();
