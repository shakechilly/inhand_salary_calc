import React from "react";

export default function Toggle({ checked, onChange, label }) {
  return (
    <button onClick={() => onChange(!checked)}>
      {label}: {checked ? "ON" : "OFF"}
    </button>
  );
}
