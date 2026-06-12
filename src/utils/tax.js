import { SLABS } from "../constants/taxSlabs";

export function computeTax(ti) {
  if (ti <= 0) return 0;

  let tax = 0;

  for (const slab of SLABS) {
    if (ti <= slab.min) break;

    tax +=
      (Math.min(ti, slab.max) - slab.min) *
      slab.rate;
  }

  if (ti <= 700000) {
    tax = 0;
  }

  return tax * 1.04;
}

export function slabBreakdown(ti) {
  return SLABS.filter(s => ti > s.min).map(s => ({
    ...s,
    taxHere:
      (Math.min(ti, s.max) - s.min) *
      s.rate
  }));
}
