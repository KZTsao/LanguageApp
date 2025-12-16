// frontend/src/components/WordHeaderMainLineDefinitionZh.jsx

function DefinitionZhSection({
  definitionList,
  labelDefinition,
  getDefinitionIndexLabel,
}) {
  if (!definitionList || definitionList.length === 0) return null;

  return (
    <div style={{ marginBottom: 8, fontSize: 14 }}>
      <strong>{labelDefinition}：</strong>
      <div style={{ marginTop: 4 }}>
        {definitionList.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "flex-start",
              marginBottom: 2,
            }}
          >
            <span
              style={{
                marginRight: 4,
                fontSize: 14,
                lineHeight: 1.4,
              }}
            >
              {getDefinitionIndexLabel(idx)}
            </span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DefinitionZhSection;
