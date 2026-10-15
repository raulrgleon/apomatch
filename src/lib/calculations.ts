import { calculationSchema } from './validation';
export function propertyTax(input: unknown) {
  const x = calculationSchema.parse(input);
  // Round currency at the annual bill level, not at intermediate rates.
  const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const currentAnnual = round((x.assessedValue * x.currentRate) / 100);
  const proposedAnnual = round((x.assessedValue * x.proposedRate) / 100);
  return {
    currentAnnual,
    proposedAnnual,
    annualDifference: round(proposedAnnual - currentAnnual),
    monthlyDifference: round((proposedAnnual - currentAnnual) / 12),
    currency: 'USD',
    modelVersion: 1,
    isHypothetical: true,
  };
}
