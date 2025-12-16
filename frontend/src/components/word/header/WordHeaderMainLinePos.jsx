// frontend/src/components/WordHeaderMainLinePos.jsx

function PosSection({ posDisplay }) {
  if (!posDisplay) return null;

  return (
    <div
      style={{
        color: "var(--text-muted)",
        marginBottom: 8,
        fontSize: 13,
      }}
    >
      {posDisplay}
    </div>
  );
}

export default PosSection;
