import { useAuth } from "../context/AuthProvider";

export default function UserHeader() {
  const { user, signOut } = useAuth();

  if (!user) return null;

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span>{user.email}</span>
      <button onClick={signOut}>登出</button>
    </div>
  );
}
