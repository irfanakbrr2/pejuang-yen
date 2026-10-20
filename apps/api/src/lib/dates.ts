export function addDays(from: Date | string, days: number): string {
  const d = typeof from === 'string' ? new Date(from) : new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function membershipExpiresAt(paidAt: string, durationType: string, durationDays: number | null): string | null {
  if (durationType === 'lifetime') return null;
  if (durationType === 'monthly') return addDays(paidAt, 30);
  if (durationType === 'yearly') return addDays(paidAt, 365);
  if (durationType === 'custom' && durationDays) return addDays(paidAt, durationDays);
  return addDays(paidAt, 30);
}
