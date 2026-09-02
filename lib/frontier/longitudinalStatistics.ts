const PROBABILITY_EPSILON = 1e-12;

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
}

function logGamma(value: number): number {
  const coefficients = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ] as const;
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  const z = value - 1;
  let x = 0.99999999999980993;
  for (let index = 0; index < coefficients.length; index += 1) x += coefficients[index] / (z + index + 1);
  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function logBinomialPmf(successes: number, trials: number, probability: number): number {
  if (successes < 0 || successes > trials) return Number.NEGATIVE_INFINITY;
  if (probability <= 0) return successes === 0 ? 0 : Number.NEGATIVE_INFINITY;
  if (probability >= 1) return successes === trials ? 0 : Number.NEGATIVE_INFINITY;
  return logGamma(trials + 1)
    - logGamma(successes + 1)
    - logGamma(trials - successes + 1)
    + successes * Math.log(probability)
    + (trials - successes) * Math.log1p(-probability);
}

/**
 * Exact conditional test for equal Poisson cue rates in two windows.
 *
 * Under H0, conditioning on the total cue count removes the unknown common
 * rate and leaves K_recent ~ Binomial(K_total, recentExposure / totalExposure).
 * The two-sided p-value uses probability ordering: it sums all binomial
 * outcomes no more likely than the observed outcome under H0.
 */
export function exactConditionalPoissonRatePValue(
  recentCount: number,
  recentExposure: number,
  previousCount: number,
  previousExposure: number,
): number {
  if (!Number.isFinite(recentExposure) || !Number.isFinite(previousExposure)
    || recentExposure <= 0 || previousExposure <= 0) return 1;

  const recent = Math.max(0, Math.floor(Number.isFinite(recentCount) ? recentCount : 0));
  const previous = Math.max(0, Math.floor(Number.isFinite(previousCount) ? previousCount : 0));
  const total = recent + previous;
  if (total === 0) return 1;

  const probability = recentExposure / (recentExposure + previousExposure);
  if (!(probability > 0 && probability < 1)) return 1;

  const observedLogProbability = logBinomialPmf(recent, total, probability);
  let pValue = 0;
  for (let candidate = 0; candidate <= total; candidate += 1) {
    const candidateLogProbability = logBinomialPmf(candidate, total, probability);
    if (candidateLogProbability <= observedLogProbability + PROBABILITY_EPSILON) {
      pValue += Math.exp(candidateLogProbability);
    }
  }
  return clampProbability(pValue);
}

/** Standard Benjamini-Hochberg step-up adjustment, returned in input order. */
export function benjaminiHochbergQValues(pValues: number[]): number[] {
  if (!pValues.length) return [];
  const indexed = pValues.map((value, index) => ({ index, value: clampProbability(value) }))
    .sort((left, right) => left.value - right.value || left.index - right.index);
  const adjusted = new Array<number>(pValues.length).fill(1);
  let running = 1;
  for (let rank = indexed.length - 1; rank >= 0; rank -= 1) {
    running = Math.min(running, indexed[rank].value * indexed.length / (rank + 1));
    adjusted[indexed[rank].index] = clampProbability(running);
  }
  return adjusted;
}
