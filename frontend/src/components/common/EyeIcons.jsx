// frontend/src/components/common/EyeIcons.jsx
import React from "react";

// Keep identical visuals as ExampleSentence.jsx
export const MOSAIC_LINE = "----------------------------";

export const EyeIconOpen = ({ size = 18, className = "eye-icon" }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      d="M12 5C7 5 3.2 8 1.5 12 3.2 16 7 19 12 19s8.8-3 10.5-7C20.8 8 17 5 12 5z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);

export const EyeIconClosed = ({ size = 18, className = "eye-icon" }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    {/* upper eyelid */}
    <path
      d="M4 12c2.5 2.5 5.5 3.8 8 3.8s5.5-1.3 8-3.8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* lower eyelid */}
    <path
      d="M6.5 13.2c1.7 1.2 3.6 1.8 5.5 1.8s3.8-.6 5.5-1.8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      opacity="0.7"
    />
  </svg>
);
