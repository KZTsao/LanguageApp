// frontend/src/utils/apiClient.js

export const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function getAccessToken() {
  try {
    const raw = localStorage.getItem("sb-yeemivptkzwqcnuzexdl-auth-token");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token || null;
  } catch {
    return null;
  }
}

export async function apiFetch(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
  };

  const token = getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const resp = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // ✅ 核心新增：只有「真的打成功 API」才通知 usage 更新
  // - resp.ok = HTTP 2xx
  // - 不管是不是 analyze / tts / dictionary，只要是後端 API 都算
  if (resp.ok) {
    window.dispatchEvent(new Event("usage-updated"));
  }

  return resp;
}
