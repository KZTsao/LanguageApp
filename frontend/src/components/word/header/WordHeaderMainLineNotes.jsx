// frontend/src/components/WordHeaderMainLineNotes.jsx

function NotesSection({ notes, sectionNotes }) {
  if (!notes) return null;

  return (
    <div style={{ marginTop: 14, fontSize: 13 }}>
      <div
        style={{
          color: "var(--text-muted)",
          marginBottom: 4,
        }}
      >
        {sectionNotes}
      </div>
      <div>{notes}</div>
    </div>
  );
}

export default NotesSection;
