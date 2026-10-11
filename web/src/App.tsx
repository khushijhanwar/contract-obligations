import { useEffect, useRef, useState } from "react";

type Doc = { id: string; filename: string; split: string | null; status: string };
type Extraction = {
  id: string;
  fieldName: string;
  value: string;
  sourceClause: string;
  startOffset: number;
  endOffset: number;
  status: "pending" | "approved" | "corrected";
};
type DocDetail = Doc & { rawText: string; extractions: Extraction[] };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init);
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

export default function App() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docId, setDocId] = useState("");
  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [reviewer, setReviewer] = useState(() => localStorage.getItem("reviewer") ?? "");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const markRef = useRef<HTMLElement>(null);

  useEffect(() => {
    api<Doc[]>("/documents").then(setDocs).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    localStorage.setItem("reviewer", reviewer);
  }, [reviewer]);

  useEffect(() => {
    if (!docId) return;
    setDoc(null);
    setSelected(null);
    setEditing(null);
    api<DocDetail>(`/documents/${docId}`).then(setDoc).catch((e) => setError(String(e)));
  }, [docId]);

  const current = doc?.extractions.find((e) => e.id === selected) ?? null;

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center" });
  }, [selected, doc]);

  async function review(ex: Extraction, body: object) {
    if (!reviewer.trim()) {
      setError("Enter your name first.");
      return;
    }
    setError("");
    try {
      const out = await api<{ extraction: Extraction }>(`/extractions/${ex.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, reviewer: reviewer.trim() }),
      });
      setDoc((d) =>
        d && { ...d, extractions: d.extractions.map((e) => (e.id === ex.id ? { ...e, ...out.extraction } : e)) },
      );
      setEditing(null);
    } catch (e) {
      setError(String(e));
    }
  }

  const text = doc?.rawText ?? "";
  const before = current ? text.slice(0, current.startOffset) : text;
  const clause = current ? text.slice(current.startOffset, current.endOffset) : "";
  const after = current ? text.slice(current.endOffset) : "";
  const done = doc?.extractions.filter((e) => e.status !== "pending").length ?? 0;

  return (
    <div className="app">
      <header>
        <h1>Contract review</h1>
        <select value={docId} onChange={(e) => setDocId(e.target.value)}>
          <option value="">Choose a contract…</option>
          {docs.map((d) => (
            <option key={d.id} value={d.id}>
              [{d.split ?? "-"}] {d.filename}
            </option>
          ))}
        </select>
        <input placeholder="Your name" value={reviewer} onChange={(e) => setReviewer(e.target.value)} />
        {doc && (
          <span className="progress">
            {done} of {doc.extractions.length} reviewed
          </span>
        )}
      </header>
      {error && <div className="error">{error}</div>}
      <main>
        <section className="contract">
          {doc ? (
            <pre>
              {before}
              {current && <mark ref={markRef}>{clause}</mark>}
              {after}
            </pre>
          ) : (
            <p className="hint">Pick a contract to start.</p>
          )}
        </section>
        <aside className="fields">
          {doc?.extractions.map((ex) => (
            <div
              key={ex.id}
              className={`card ${ex.id === selected ? "active" : ""}`}
              onClick={() => setSelected(ex.id)}
            >
              <div className="row">
                <strong>{ex.fieldName}</strong>
                <span className={`badge ${ex.status}`}>{ex.status}</span>
              </div>
              {editing === ex.id ? (
                <div onClick={(e) => e.stopPropagation()}>
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} />
                  <button onClick={() => review(ex, { action: "corrected", newValue: draft })}>Save</button>
                  <button onClick={() => setEditing(null)}>Cancel</button>
                </div>
              ) : (
                <>
                  <div className="value">{ex.value}</div>
                  <div className="actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        review(ex, { action: "approved" });
                      }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(ex.id);
                        setDraft(ex.value);
                      }}
                    >
                      Correct
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {doc && doc.extractions.length === 0 && <p className="hint">No extracted fields for this contract yet.</p>}
        </aside>
      </main>
    </div>
  );
}
