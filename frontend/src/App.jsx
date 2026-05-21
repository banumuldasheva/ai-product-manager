import { useEffect, useState } from "react";

function useApi(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [url]);

  return { data, loading, error };
}

export default function App() {
  const hello = useApi("/api/hello");
  const health = useApi("/api/health");

  return (
    <main>
      <h1>Full-Stack Template</h1>
      <section>
        <h2>/api/hello</h2>
        {hello.loading && <p className="muted">loading…</p>}
        {hello.error && <p className="error">{hello.error}</p>}
        {hello.data && <p>{hello.data.message}</p>}
      </section>
      <section>
        <h2>/api/health</h2>
        {health.loading && <p className="muted">loading…</p>}
        {health.error && <p className="error">{health.error}</p>}
        {health.data && (
          <p>
            status: <strong>{health.data.status}</strong> &nbsp;·&nbsp; db:{" "}
            <strong>{health.data.db}</strong>
          </p>
        )}
      </section>
    </main>
  );
}
