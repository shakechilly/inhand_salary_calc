import React from "react";

export default function Card({ label, value }) {
  return <div><strong>{label}</strong>: {value}</div>;
}
