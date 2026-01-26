// frontend/src/components/common/SpeakButton.jsx (file start)
import React from "react";

// ✅ Reusable speak (TTS) button
// - Matches ExampleSentence.jsx styling: className="icon-button sound-button"
// - Use anywhere that needs "play sentence" behavior.
// - Props:
//   - onClick: () => void
//   - title: string
//   - disabled: boolean
//   - size: number (optional; default 18 icon in 24 viewBox)
//   - className/style: pass-through for layout tweaks
export default function SpeakButton({
  onClick,
  title,
  disabled,
  className,
  style,
  ariaLabel,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title || "播放語音"}
      aria-label={ariaLabel || "play-sentence"}
      className={className || "icon-button sound-button"}
      disabled={!!disabled}
      style={style}
    >
      <svg
        className="sound-icon"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <polygon points="10,8 10,16 16,12" />
      </svg>
    </button>
  );
}
// frontend/src/components/common/SpeakButton.jsx (file end)
