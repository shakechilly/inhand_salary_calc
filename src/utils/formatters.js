export const fmtINR = n =>
  "₹" +
  Math.round(n).toLocaleString(
    "en-IN"
  );

export const fmtL = n => {
  if (n >= 10000000)
    return (
      (n / 10000000).toFixed(1) +
      "Cr"
    );

  if (n >= 100000)
    return (
      (n / 100000).toFixed(1) +
      "L"
    );

  if (n >= 1000)
    return (
      (n / 1000).toFixed(0) +
      "K"
    );

  return String(Math.round(n));
};
