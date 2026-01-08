# Learnings

Documentation and essays exploring subscription architectures with Stripe. This directory contains two approaches:

## Directory Structure

### [Custom Entitlement](./custom-entitlement/)
The traditional approach: Your application manages credits/entitlements locally, with Stripe handling payments only.

- **Why Your App Must Handle Credits, Not Stripe** — Explains the prepaid vs post-paid distinction
- **The Dance Between Stripe and Your Application** — End-to-end system narrative
- **Stripe Credits vs. Local Credits** — Comparison of Stripe's Credits feature vs local implementation
- **Implementation Notes** — Practical guide with code snippets
- **Corner Cases** — 10 edge cases that break most implementations

### [Stripe Native](./stripe-native/)
The Stripe-native approach: Let Stripe handle everything through Meters and usage-based billing.

- **The Elegant Simplicity of Letting Stripe Do Its Job** — Architecture essay on Stripe-native implementation

## Quick Comparison

| Aspect | Custom Entitlement | Stripe Native |
|--------|-------------------|---------------|
| **Model** | Prepaid (credits) | Post-paid (usage) |
| **Blocking** | Users blocked at 0 credits | Never blocked |
| **Complexity** | ~300 lines credit logic | ~50 lines meter integration |
| **Source of Truth** | Local database | Stripe Meters |
| **Overages** | Require addon purchase | Automatic, billed at cycle end |
