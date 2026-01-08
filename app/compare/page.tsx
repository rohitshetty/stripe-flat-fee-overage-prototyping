'use client'

/**
 * Comparison Page: Credits vs Native Implementation
 *
 * Side-by-side comparison of implementation complexity and trade-offs.
 */

import Link from 'next/link'

const metrics = {
  credits: {
    name: 'Custom Credits',
    description: 'Pre-pay model with local credit tracking',
    dbTables: 5,
    dbColumns: '~45',
    businessLogicFiles: 6,
    linesOfCode: '~600',
    webhookHandlers: '7 (complex)',
    raceConditionHandling: 'Required (locks)',
    creditExpiration: 'Custom logic',
    usageTracking: 'Local database',
    keyFile: 'lib/credits.ts (258 lines)',
    apiEndpoint: 'api/credits/use/route.ts',
    path: '/',
  },
  native: {
    name: 'Stripe Native',
    description: 'Post-pay model with Stripe Meters',
    dbTables: 3,
    dbColumns: '~15',
    businessLogicFiles: 1,
    linesOfCode: '~150',
    webhookHandlers: '4 (simple)',
    raceConditionHandling: 'Not needed',
    creditExpiration: 'None (Stripe)',
    usageTracking: 'Stripe Meters',
    keyFile: 'lib/native/meter.ts (45 lines)',
    apiEndpoint: 'api/native/action/route.ts',
    path: '/native',
  },
}

const tradeoffs = {
  credits: [
    { type: 'pro', text: 'Pre-pay: User controls their spend' },
    { type: 'pro', text: 'Add-on upsell opportunity' },
    { type: 'pro', text: 'Flexible custom business rules' },
    { type: 'con', text: 'Complex implementation (~600 lines)' },
    { type: 'con', text: 'Sync issues between Stripe & local DB' },
    { type: 'con', text: 'Users blocked when credits = 0' },
  ],
  native: [
    { type: 'pro', text: 'Simple implementation (~150 lines)' },
    { type: 'pro', text: 'Stripe handles all usage tracking' },
    { type: 'pro', text: 'Users never blocked' },
    { type: 'con', text: 'Post-pay: Surprise bills possible' },
    { type: 'con', text: 'No add-on upsell concept' },
    { type: 'con', text: 'Less flexible (Stripe\'s model)' },
  ],
}

export default function ComparePage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Header */}
      <header className="text-center mb-12 opacity-0 animate-fade-in">
        <h1 className="font-display text-4xl font-semibold text-forest-800 tracking-tight">
          Implementation Comparison
        </h1>
        <p className="font-body text-charcoal-500 mt-2">
          Custom Credits vs Stripe Native (Flat Fee + Overages)
        </p>
      </header>

      {/* Complexity Summary */}
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {/* Credits Card */}
        <div className="card-ledger p-8 opacity-0 animate-slide-up">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="font-display text-2xl font-semibold text-forest-800">
                {metrics.credits.name}
              </h2>
              <p className="font-body text-sm text-charcoal-500 mt-1">
                {metrics.credits.description}
              </p>
            </div>
            <span className="badge badge-charcoal">Complex</span>
          </div>

          <dl className="space-y-3 mb-6">
            <div className="flex justify-between border-b border-charcoal-100 pb-2">
              <dt className="font-body text-sm text-charcoal-500">Database tables</dt>
              <dd className="font-mono text-sm text-forest-800">{metrics.credits.dbTables}</dd>
            </div>
            <div className="flex justify-between border-b border-charcoal-100 pb-2">
              <dt className="font-body text-sm text-charcoal-500">Business logic files</dt>
              <dd className="font-mono text-sm text-forest-800">{metrics.credits.businessLogicFiles}</dd>
            </div>
            <div className="flex justify-between border-b border-charcoal-100 pb-2">
              <dt className="font-body text-sm text-charcoal-500">Lines of code</dt>
              <dd className="font-mono text-sm text-forest-800">{metrics.credits.linesOfCode}</dd>
            </div>
            <div className="flex justify-between border-b border-charcoal-100 pb-2">
              <dt className="font-body text-sm text-charcoal-500">Webhook handlers</dt>
              <dd className="font-mono text-sm text-forest-800">{metrics.credits.webhookHandlers}</dd>
            </div>
            <div className="flex justify-between border-b border-charcoal-100 pb-2">
              <dt className="font-body text-sm text-charcoal-500">Race conditions</dt>
              <dd className="font-mono text-sm text-burgundy-600">{metrics.credits.raceConditionHandling}</dd>
            </div>
            <div className="flex justify-between pb-2">
              <dt className="font-body text-sm text-charcoal-500">Key file</dt>
              <dd className="font-mono text-xs text-charcoal-600">{metrics.credits.keyFile}</dd>
            </div>
          </dl>

          <Link href={metrics.credits.path} className="btn-secondary w-full">
            View Credits Dashboard
          </Link>
        </div>

        {/* Native Card */}
        <div className="card-ledger p-8 ring-2 ring-brass-400 opacity-0 animate-slide-up stagger-1">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="font-display text-2xl font-semibold text-forest-800">
                {metrics.native.name}
              </h2>
              <p className="font-body text-sm text-charcoal-500 mt-1">
                {metrics.native.description}
              </p>
            </div>
            <span className="badge badge-brass">75% Less Code</span>
          </div>

          <dl className="space-y-3 mb-6">
            <div className="flex justify-between border-b border-charcoal-100 pb-2">
              <dt className="font-body text-sm text-charcoal-500">Database tables</dt>
              <dd className="font-mono text-sm text-forest-800">{metrics.native.dbTables}</dd>
            </div>
            <div className="flex justify-between border-b border-charcoal-100 pb-2">
              <dt className="font-body text-sm text-charcoal-500">Business logic files</dt>
              <dd className="font-mono text-sm text-forest-800">{metrics.native.businessLogicFiles}</dd>
            </div>
            <div className="flex justify-between border-b border-charcoal-100 pb-2">
              <dt className="font-body text-sm text-charcoal-500">Lines of code</dt>
              <dd className="font-mono text-sm text-forest-800">{metrics.native.linesOfCode}</dd>
            </div>
            <div className="flex justify-between border-b border-charcoal-100 pb-2">
              <dt className="font-body text-sm text-charcoal-500">Webhook handlers</dt>
              <dd className="font-mono text-sm text-forest-800">{metrics.native.webhookHandlers}</dd>
            </div>
            <div className="flex justify-between border-b border-charcoal-100 pb-2">
              <dt className="font-body text-sm text-charcoal-500">Race conditions</dt>
              <dd className="font-mono text-sm text-forest-600">{metrics.native.raceConditionHandling}</dd>
            </div>
            <div className="flex justify-between pb-2">
              <dt className="font-body text-sm text-charcoal-500">Key file</dt>
              <dd className="font-mono text-xs text-charcoal-600">{metrics.native.keyFile}</dd>
            </div>
          </dl>

          <Link href={metrics.native.path} className="btn-primary w-full">
            View Native Dashboard
          </Link>
        </div>
      </div>

      {/* Trade-offs */}
      <div className="card-ledger p-8 mb-12 opacity-0 animate-slide-up stagger-2">
        <h2 className="section-header mb-8 text-center">Trade-offs</h2>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Credits Trade-offs */}
          <div>
            <h3 className="font-body text-sm font-medium text-charcoal-600 mb-4 text-center">
              Custom Credits
            </h3>
            <ul className="space-y-3">
              {tradeoffs.credits.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  {item.type === 'pro' ? (
                    <svg className="w-5 h-5 text-forest-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-burgundy-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <span className="font-body text-sm text-charcoal-600">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Native Trade-offs */}
          <div>
            <h3 className="font-body text-sm font-medium text-brass-700 mb-4 text-center">
              Stripe Native
            </h3>
            <ul className="space-y-3">
              {tradeoffs.native.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  {item.type === 'pro' ? (
                    <svg className="w-5 h-5 text-forest-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-burgundy-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <span className="font-body text-sm text-charcoal-600">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Code Comparison */}
      <div className="card-ledger p-8 opacity-0 animate-slide-up stagger-3">
        <h2 className="section-header mb-6">Key Code Difference</h2>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Credits Code */}
          <div>
            <h3 className="font-mono text-sm text-charcoal-500 mb-3">
              Credits: api/credits/use/route.ts
            </h3>
            <pre className="bg-charcoal-50 p-4 rounded-lg text-xs font-mono text-charcoal-700 overflow-x-auto">
{`// Calls useCredit() which does:
// 1. Acquire transaction lock
// 2. Check subscription status
// 3. Get credit balance
// 4. Determine credit type priority
// 5. Decrement correct credit type
// 6. Update database
// 7. Increment action counter
// 8. Log audit event
// 9. Release lock
// 10. Return new balance

const result = useCredit(userId)
// ~85 lines of logic in lib/credits.ts`}
            </pre>
          </div>

          {/* Native Code */}
          <div>
            <h3 className="font-mono text-sm text-brass-600 mb-3">
              Native: api/native/action/route.ts
            </h3>
            <pre className="bg-brass-50 p-4 rounded-lg text-xs font-mono text-charcoal-700 overflow-x-auto">
{`// Just send a meter event to Stripe
const result = await recordAction(
  user.stripe_customer_id
)

// That's it. Stripe handles:
// - Usage aggregation
// - Billing calculation
// - Period resets
// - Invoice line items

// ~15 lines of logic in lib/native/meter.ts`}
            </pre>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 text-center opacity-0 animate-fade-in stagger-4">
        <p className="font-body text-sm text-charcoal-400">
          Both implementations are fully functional. Choose based on your business needs.
        </p>
        <div className="flex justify-center gap-4 mt-4">
          <Link href="/" className="btn-ghost">
            Credits Dashboard
          </Link>
          <Link href="/native" className="btn-ghost">
            Native Dashboard
          </Link>
        </div>
      </footer>
    </div>
  )
}
