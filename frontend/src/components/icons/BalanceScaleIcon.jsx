// frontend/src/components/common/BalanceScaleIcon.jsx
import React from "react";

/**
 * BalanceScaleIcon (天秤)
 * - stroke uses currentColor so it follows surrounding text color.
 * - size: px
 */
export default function BalanceScaleIcon({ size = 18, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* pillar */}
      <path
        d="M12 3v17"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {/* base */}
      <path
        d="M7 21h10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {/* beam */}
      <path
        d="M6 7h12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {/* left hanger */}
      <path
        d="M8 7l-3 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8 7l3 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* right hanger */}
      <path
        d="M16 7l-3 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M16 7l3 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* left pan */}
      <path
        d="M4.75 13h6.5c-.35 1.55-1.7 2.75-3.25 2.75S5.1 14.55 4.75 13z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* right pan */}
      <path
        d="M12.75 13h6.5c-.35 1.55-1.7 2.75-3.25 2.75s-2.9-1.2-3.25-2.75z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
// frontend/src/components/common/BalanceScaleIcon.jsx
