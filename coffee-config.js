/**
 * Coffee support — Stripe
 * Secret keys stay on the server (Google Apps Script). This file is public.
 */
window.COFFEE_CONFIG = {
  minAmount: 5,
  maxAmount: 5000,
  currency: 'USD',

  /*
   * Must be a “Customers choose what to pay” Payment Link — not a fixed $10 product.
   * Create one: https://dashboard.stripe.com/payment-links/create/customer-chooses-pricing
   * Set minimum $5, then paste the buy.stripe.com URL here.
   */
  stripePaymentLink: 'https://buy.stripe.com/8x26oH6f9gqP65e5N61B601',

  /* Optional: one fixed Payment Link per chip if you prefer separate $10 / $25 links. */
  stripePaymentLinks: {
    '5': '',
    '10': '',
    '15': '',
    '25': '',
    '50': ''
  },

  /* Optional Apps Script URL for custom amounts (tools/coffee-payments.gs). */
  stripeCheckoutUrl: '',

  /* Stripe publishable key is optional if you only use Payment Links. */
  stripePublishableKey: '',

  paypalClientId: '',

  recipientName: 'Shariar Ahmed',
  coffeeMessage: 'Thanks for the coffee — it means a lot!'
};
