import { useEffect, useMemo, useState } from "react";
import { createLooseEndLog, getKases, getLooseEnds, updateLog } from "../api";

export default function LooseEnds({ navigate }: { navigate: (path: string) => void }) {
  const [logItems, setLogItems] = useState<any[]>([]);
  const [kases, setKases] = useState<any[]>([]);

  useEffect(() => {
    void Promise.all([getLooseEnds(), getKases()]).then(([loose, allKases]) => {
      setLogItems(loose);
      setKases(allKases);
    });
  }, []);

  const kaseOptions = useMemo(() => kases, [kases]);

  return <section>
    <h1>Loose Ends</h1>
    <p>Logs without a kase</p>
    <button onClick={async () => { const created = await createLooseEndLog(); navigate(`/logs/${created.id}`); }}>New Log</button>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
      {logItems.map((logEntry) => <article key={logEntry.id}>
        <h3>{logEntry.title}</h3>
        <p>{(logEntry.content ?? "").slice(0, 120)}</p>
        <small>{new Date(logEntry.updatedAt).toLocaleString()}</small>
        <select onChange={async (event) => {
          const selectedKaseId = event.target.value;
          if (!selectedKaseId) return;
          await updateLog(logEntry.id, { kaseId: selectedKaseId });
          setLogItems((prev) => prev.filter((logItem) => logItem.id !== logEntry.id));
        }}>
          <option value="">Assign to Kase</option>
          {kaseOptions.map((kase) => <option key={kase.id} value={kase.id}>{kase.name}</option>)}
        </select>
      </article>)}
    </div>
    {logItems.length === 0 ? <div>No loose ends. Everything is filed.</div> : null}
  </section>;
}
