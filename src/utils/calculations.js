import { computeTax } from "./tax";

export function calcAll(
  ctc,
  pfPct,
  npsPct,
  pfFixed
) {
  const basic = ctc / 2;

  const empPF = pfFixed
    ? 21600
    : basic * pfPct / 100;

  const emplPF = pfFixed
    ? 21600
    : basic * pfPct / 100;

  const nps =
    basic * npsPct / 100;

  const taxableIncome =
    ctc -
    empPF -
    nps -
    75000;

  const annualTax =
    computeTax(
      Math.max(0, taxableIncome)
    );

  const preMonthly =
    (
      ctc -
      empPF -
      emplPF -
      nps
    ) / 12;

  const inHand =
    preMonthly -
    annualTax / 12;

  return {
    basic,
    empPF,
    emplPF,
    nps,
    taxableIncome,
    annualTax,
    preMonthly,
    inHand
  };
}
