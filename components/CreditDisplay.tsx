'use client'

interface CreditDisplayProps {
  subscriptionCredits: number
  addonCredits: number
  totalCredits: number
}

export function CreditDisplay({
  subscriptionCredits,
  addonCredits,
  totalCredits,
}: CreditDisplayProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Credit Balance</h2>

      <div className="text-center mb-6">
        <span className="text-5xl font-bold text-gray-900">{totalCredits}</span>
        <span className="text-gray-500 ml-2">credits</span>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Subscription credits</span>
          <span className="font-medium text-gray-900">{subscriptionCredits}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Add-on credits</span>
          <span className="font-medium text-gray-900">{addonCredits}</span>
        </div>
      </div>

      {totalCredits <= 2 && totalCredits > 0 && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
          <p className="text-sm text-amber-800">
            Low credits! Consider purchasing an add-on pack.
          </p>
        </div>
      )}

      {totalCredits === 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">
            No credits remaining. Purchase add-ons to continue.
          </p>
        </div>
      )}
    </div>
  )
}
