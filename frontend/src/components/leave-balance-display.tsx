"use client";

interface LeaveBalance {
  openingBalance: number;
  carryForward: number;
  used: number;
  pending: number;
  available: number;
}

export function LeaveBalanceDisplay({ balance }: { balance: LeaveBalance }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-sm text-slate-600">Annual Quota:</span>
        <span className="text-sm font-medium">{balance.openingBalance} days</span>
      </div>
      <div className="flex justify-between">
        <span className="text-sm text-slate-600">Carry Forward:</span>
        <span className="text-sm font-medium">{balance.carryForward} days</span>
      </div>
      <div className="flex justify-between text-green-600 font-semibold">
        <span className="text-sm">Effective Balance:</span>
        <span className="text-sm">{balance.available} days</span>
      </div>
      <div className="flex justify-between">
        <span className="text-sm text-slate-600">Used:</span>
        <span className="text-sm font-medium text-red-600">{balance.used} days</span>
      </div>
      <div className="flex justify-between">
        <span className="text-sm text-slate-600">Pending:</span>
        <span className="text-sm font-medium text-amber-600">{balance.pending} days</span>
      </div>
    </div>
  );
}
