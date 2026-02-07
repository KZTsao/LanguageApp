// frontend/src/pages/ReaderPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import ReaderView from "../features/reader/ReaderView";
import * as apiClient from "../utils/apiClient";

/**
 * ReaderPage（User 入口預設：/reader/:id）
 * - ❗不依賴 react-router-dom
 * - unitId 一律由外層（App.jsx path gate）傳入
 */
export default function ReaderPage({ unitId } = {}) {
  const [loading, setLoading] = useState(true);
  const [lock, setLock] = useState(null);
  const [data, setData] = useState(null);

  const title = useMemo(() => data?.unit?.title || "Reader", [data]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!unitId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setLock(null);

      try {
        const resp = await apiClient.get(`/api/units/${unitId}`);
        if (!mounted) return;
        setData(resp?.data || null);
      } catch (e) {
        if (!mounted) return;
        const status = e?.response?.status;
        if (status === 403) {
          setLock(e?.response?.data || { lock_state: "teaser" });
        } else {
          setLock({ error: "load_failed" });
        }
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [unitId]);

  if (!unitId) {
    return <div style={{ padding: 16, opacity: 0.75 }}>Missing unit id.</div>;
  }

  if (loading) {
    return <div style={{ padding: 16, opacity: 0.75 }}>Loading…</div>;
  }

  if (lock && lock.lock_state && lock.lock_state !== "available") {
    return (
      <div style={{ padding: 18, maxWidth: 720 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{title}</div>
        <div style={{ opacity: 0.8, lineHeight: 1.6 }}>
          此內容尚未上架（{lock.lock_state === "teaser" ? "預告中" : "未開放"}）。
        </div>
        {lock.publish_at ? (
          <div style={{ marginTop: 10, opacity: 0.8 }}>
            上架時間：{String(lock.publish_at)}
          </div>
        ) : null}
      </div>
    );
  }

  if (!data) {
    return <div style={{ padding: 16, opacity: 0.75 }}>Load failed.</div>;
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{title}</div>
      <ReaderView pages={data.pages} sentences={data.sentences} />
    </div>
  );
}
