# Stripe Setup Guide

This guide covers setting up Stripe for the subscription prototype.

## 1. Get API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Make sure you're in **Test Mode** (toggle in top-right)
3. Copy your keys:
   - **Publishable key**: `pk_test_...`
   - **Secret key**: `sk_test_...`

Add to `.env.local`:
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## 2. Create Products (Automated)

Run the setup script:
```bash
npm run stripe:setup
```

This creates:
- 3 subscription products (Starter, Expert, Pro)
- 3 add-on products (Small, Medium, Large packs)

Copy the output price IDs to `.env.local`.

## 3. Configure Customer Portal

1. Go to [Customer Portal Settings](https://dashboard.stripe.com/test/settings/billing/portal)
2. Enable these features:
   - **Subscriptions**: Allow customers to switch plans
   - **Payment methods**: Allow updating payment methods
   - **Cancellation**: Allow customers to cancel
   - **Invoice history**: Show past invoices

3. Under "Products":
   - Add all three subscription products
   - Enable switching between them

## 4. Set Up Webhooks (Local Development)

Install Stripe CLI:
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Linux
# Download from https://github.com/stripe/stripe-cli/releases

# Windows
# Download from https://github.com/stripe/stripe-cli/releases
```

Login and start forwarding:
```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the webhook secret (`whsec_...`) to `.env.local`:
```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 5. Test Cards

Use these test cards in Stripe Checkout:

| Scenario | Card Number |
|----------|-------------|
| Successful payment | 4242 4242 4242 4242 |
| Requires authentication | 4000 0025 0000 3155 |
| Declined | 4000 0000 0000 9995 |

Expiry: Any future date
CVC: Any 3 digits
ZIP: Any 5 digits

## 6. Webhook Events

The prototype handles these events:

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Process checkout, allocate addon credits |
| `customer.subscription.created` | Create subscription, allocate credits |
| `customer.subscription.updated` | Update tier/status, handle upgrades |
| `customer.subscription.deleted` | Expire credits, mark canceled |
| `invoice.paid` | Allocate renewal credits |
| `invoice.payment_failed` | Set past_due status |

## 7. Production Considerations

For production deployment:

1. **Webhook endpoint**: Create a webhook in [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
   - URL: `https://your-domain.com/api/webhooks/stripe`
   - Events: Select all subscription and invoice events

2. **Environment variables**: Use production keys (`sk_live_...`)

3. **Customer Portal**: Enable in live mode with same settings

4. **Error monitoring**: Add logging/monitoring for webhook failures

## Troubleshooting

### Webhooks not arriving
- Check Stripe CLI is running: `stripe listen ...`
- Verify webhook secret matches in `.env.local`
- Check server console for errors

### "Price ID not configured" error
- Run `npm run stripe:setup`
- Copy price IDs to `.env.local`
- Restart dev server

### Customer Portal returns error
- User must have a Stripe customer ID
- Complete a checkout first to create customer

### Credits not allocated after checkout
- Check webhook logs: `stripe events list --limit 5`
- Verify webhook handler processed event (check `credit_log` table)
