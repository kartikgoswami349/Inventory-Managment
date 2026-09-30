import { useEffect, useMemo, useState } from 'react';

type Page = 'dashboard' | 'inventory' | 'transactions' | 'sync';

type InventoryRow = {
  id: string;
  stock_id: string;
  old_item_id: string | null;
  item_name: string;
  unit: string;
  minimum_stock: number;
  current_stock: number;
};

type NearbyDevice = {
  deviceId: string;
  deviceName: string;
  serviceName: string;
  address: string;
  addresses: string[];
  port: number;
  lastSeenAt: string;
};

type TrustedDevice = {
  device_id: string;
  device_name: string;
  last_sync_at: string | null;
  last_host: string | null;
};

type TransactionRow = {
  id: string;
  stock_id: string;
  item_name: string;
  unit: string;
  transaction_type: string;
  quantity: number;
  stock_delta: number;
  department_name: string | null;
  person_name: string | null;
  other_name: string | null;
  remark: string | null;
  timestamp: string;
};

function formatDate(value: string) {
  try { return new Date(value).toLocaleString('en-IN'); } catch { return value; }
}

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [device, setDevice] = useState<{ id: string; name: string } | null>(null);
  const [trusted, setTrusted] = useState<TrustedDevice | null>(null);
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  const [nearbyDevices, setNearbyDevices] = useState<NearbyDevice[]>([]);
  const [autoSyncStatus, setAutoSyncStatus] = useState<any | null>(null);
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [pairHost, setPairHost] = useState('');
  const [pairCode, setPairCode] = useState('');
  const [pcPairCode, setPcPairCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [syncHost, setSyncHost] = useState('');

  async function refreshAll() {
    const [d, t, ts, db, inv, nearby, autoStatus] = await Promise.all([
      window.r58.getDevice(),
      window.r58.getTrusted(),
      window.r58.getTrustedDevices(),
      window.r58.getDashboard(),
      window.r58.getInventory(search),
      window.r58.getNearbyDevices(),
      window.r58.getAutoSyncStatus(),
    ]);
    setDevice(d);
    setTrusted(t);
    setTrustedDevices(ts);
    setDashboard(db);
    setInventory(inv);
    setNearbyDevices(nearby);
    setAutoSyncStatus(autoStatus);
    setSyncHost(current => current || t?.last_host || '');
    setTransactions(await window.r58.getTransactions(300));
  }

  useEffect(() => { refreshAll().catch(error => setMessage(error?.message ?? String(error))); }, []);
  useEffect(() => {
    const handle = setTimeout(() => {
      window.r58.getInventory(search).then(setInventory).catch(() => {});
    }, 220);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    const timer = setInterval(() => {
      Promise.all([
        window.r58.getNearbyDevices(),
        window.r58.getTrusted(),
        window.r58.getTrustedDevices(),
        window.r58.getAutoSyncStatus(),
      ]).then(([nearby, t, ts, autoStatus]) => {
        setNearbyDevices(nearby);
        setTrusted(t);
        setTrustedDevices(ts);
        setAutoSyncStatus(autoStatus);
        setSyncHost(current => current || t?.last_host || '');
      }).catch(() => {});
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  const stockWarnings = useMemo(
    () => inventory.filter(row => Number(row.current_stock) <= Number(row.minimum_stock)).length,
    [inventory],
  );

  async function generatePcCode() {
    setMessage('');
    try {
      const result = await window.r58.generatePairingCode();
      setPcPairCode(result);
    } catch (error: any) { setMessage(error?.message ?? String(error)); }
  }

  async function pair() {
    if (!pairHost.trim() || !pairCode.trim()) {
      setMessage('Enter the Android IP address and pairing code.');
      return;
    }
    setBusy(true); setMessage('Pairing with Android R58…');
    try {
      const result = await window.r58.pairWithDevice(pairHost.trim(), pairCode.trim());
      setTrusted(await window.r58.getTrusted());
      setTrustedDevices(await window.r58.getTrustedDevices());
      setNearbyDevices(await window.r58.getNearbyDevices());
      setSyncHost(result.host);
      setMessage(`Paired with ${result.deviceName}. Automatic sync is now enabled.`);
      setPairCode('');
    } catch (error: any) { setMessage(error?.message ?? String(error)); }
    finally { setBusy(false); }
  }

  async function forgetTrustedDevice(deviceId: string, deviceName: string) {
    if (!window.confirm(`Forget trusted device \"${deviceName}\"?\n\nThe PC will stop automatic syncing with this device. Your inventory and transaction data will not be deleted.`)) {
      return;
    }

    setBusy(true);
    setMessage(`Forgetting ${deviceName}…`);
    try {
      await window.r58.removeTrustedDevice(deviceId);
      setTrusted(null);
      setSyncHost('');
      const latestTrusted = await window.r58.getTrustedDevices();
      setTrustedDevices(latestTrusted);
      setMessage(`${deviceName} was forgotten on this PC.`);
    } catch (error: any) {
      setMessage(error?.message ?? String(error));
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    setBusy(true); setMessage('Synchronizing…');
    try {
      const discoveredHost = trusted
        ? nearbyDevices.find(item => item.deviceId === trusted.device_id)?.address
        : undefined;
      const host = discoveredHost || syncHost.trim() || undefined;
      if (host) setSyncHost(host);
      const result = await window.r58.syncWithDevice(host);
      setTrusted(await window.r58.getTrusted());
      setMessage(`Sync complete. Received ${result.received.transactions} transactions, ${result.received.items} items, and ${result.received.audits} audits.`);
      await refreshAll();
    } catch (error: any) { setMessage(error?.message ?? String(error)); }
    finally { setBusy(false); }
  }

  async function syncSelectedDevice(host: string, deviceId: string) {
    setBusy(true);
    setMessage(`Synchronizing with ${nearbyDevices.find(d => d.deviceId === deviceId)?.deviceName ?? 'R58 device'}…`);
    try {
      const result = await window.r58.syncWithTrustedDevice(host, deviceId);
      setMessage(`Sync complete. Received ${result.received.transactions} transactions, ${result.received.items} items, and ${result.received.audits} audits.`);
      await refreshAll();
    } catch (error: any) {
      setMessage(error?.message ?? String(error));
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    setBusy(true);
    try { await refreshAll(); setMessage('Data refreshed.'); }
    catch (error: any) { setMessage(error?.message ?? String(error)); }
    finally { setBusy(false); }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">R58</div>
          <div>
            <div className="brand-title">R58 Inventory</div>
            <div className="brand-sub">Windows</div>
          </div>
        </div>
        <nav>
          <NavButton icon="⌂" label="Dashboard" active={page === 'dashboard'} onClick={() => setPage('dashboard')} />
          <NavButton icon="▦" label="Inventory" active={page === 'inventory'} onClick={() => setPage('inventory')} />
          <NavButton icon="↕" label="Transactions" active={page === 'transactions'} onClick={() => setPage('transactions')} />
          <NavButton icon="◉" label="Device & Sync" active={page === 'sync'} onClick={() => setPage('sync')} />
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-dot"><span /> PC Sync Server</div>
          <div className="small-muted">TCP 45858</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <div className="page-eyebrow">R58 INVENTORY</div>
            <h1>{page === 'dashboard' ? 'Dashboard' : page === 'inventory' ? 'Inventory' : page === 'transactions' ? 'Transactions' : 'Device & Sync'}</h1>
          </div>
          <div className="top-actions">
            <button className="ghost-btn" onClick={refresh} disabled={busy}>↻ Refresh</button>
            <div className="device-chip">{device?.name ?? 'R58 PC'}</div>
          </div>
        </header>

        {message && <div className="notice">{message}</div>}

        {page === 'dashboard' && (
          <section className="content">
            <div className="hero-card">
              <div>
                <div className="hero-kicker">LOCAL-FIRST • SYNC-READY</div>
                <h2>Your Windows R58 peer is ready.</h2>
                <p>Data is stored locally on this PC and can synchronize with the existing Android R58 application over the LAN.</p>
                <button className="primary-btn" onClick={() => setPage('sync')}>Open Device & Sync →</button>
              </div>
              <div className="hero-status">
                <div className="status-circle">✓</div>
                <strong>{trusted ? `Paired with ${trusted.device_name}` : 'No Android device paired'}</strong>
                <span>{trusted?.last_sync_at ? `Last sync ${formatDate(trusted.last_sync_at)}` : 'Pair an Android R58 device to start syncing.'}</span>
              </div>
            </div>

            <div className="metric-grid">
              <Metric title="Active Items" value={dashboard?.activeItems ?? '—'} />
              <Metric title="Total Stock" value={dashboard?.totalStock ?? '—'} />
              <Metric title="Transactions" value={dashboard?.transactions ?? '—'} />
              <Metric title="Low Stock Items" value={stockWarnings} />
            </div>

            <div className="two-col">
              <div className="panel">
                <div className="panel-head"><div><h3>Inventory snapshot</h3><span>Synced local data</span></div><button className="text-btn" onClick={() => setPage('inventory')}>View all →</button></div>
                <MiniInventory rows={inventory.slice(0, 7)} />
              </div>
              <div className="panel">
                <div className="panel-head"><div><h3>Recent transactions</h3><span>Latest ledger activity</span></div><button className="text-btn" onClick={() => setPage('transactions')}>View all →</button></div>
                <MiniTransactions rows={transactions.slice(0, 7)} />
              </div>
            </div>
          </section>
        )}

        {page === 'inventory' && (
          <section className="content">
            <div className="toolbar panel">
              <div className="search-box"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item name, Stock ID, old item ID" /></div>
              <div className="toolbar-note">{inventory.length} shown</div>
            </div>
            <div className="panel table-panel">
              <TableInventory rows={inventory} />
            </div>
          </section>
        )}

        {page === 'transactions' && (
          <section className="content">
            <div className="panel table-panel">
              <div className="panel-head"><div><h3>Transaction history</h3><span>Immutable ledger received from R58 peers</span></div></div>
              <TableTransactions rows={transactions} />
            </div>
          </section>
        )}

        {page === 'sync' && (
          <section className="content sync-page">
            <div className="sync-grid">
              <div className="panel sync-card">
                <div className="panel-head"><div><h3>This PC</h3><span>Permanent R58 device identity</span></div></div>
                <div className="device-id">{device?.id ?? 'Loading…'}</div>
                <div className="pair-code-box">
                  <div><span className="small-label">PC pairing code</span><strong>{pcPairCode?.code ?? '------'}</strong><span className="small-muted">Valid for 5 minutes</span></div>
                  <button className="secondary-btn" onClick={generatePcCode}>Generate</button>
                </div>
                <p className="help-text">The existing Android R58 app can use this code when the PC is the pairing target.</p>
              </div>

              <div className="panel sync-card">
                <div className="panel-head"><div><h3>Paired Android device</h3><span>Existing deployed R58 app</span></div><span className={`pill ${trusted ? 'pill-ok' : 'pill-muted'}`}>{trusted ? 'Paired' : 'Not paired'}</span></div>
                {trusted ? (
                  <>
                    <div className="paired-name">{trusted.device_name}</div>
                    <div className="small-muted mono">{trusted.device_id}</div>
                    <label>Android IP address</label>
                    <input className="field" value={syncHost} onChange={e => setSyncHost(e.target.value)} placeholder="192.168.x.x" />
                    <button className="primary-btn full" onClick={sync} disabled={busy}>{busy ? 'Synchronizing…' : 'Sync Now ↔'}</button>
                    <div className="trusted-actions">
                      <button
                        className="danger-btn"
                        onClick={() => forgetTrustedDevice(trusted.device_id, trusted.device_name)}
                        disabled={busy}
                      >
                        Forget trusted device
                      </button>
                    </div>
                    <div className="last-sync">{trusted.last_sync_at ? `Last successful sync: ${formatDate(trusted.last_sync_at)}` : 'No successful sync recorded yet.'}</div>
                  </>
                ) : <div className="empty-sync">Pair the PC with your existing Android R58 app using the form below.</div>}
              </div>
            </div>

            <div className="panel nearby-panel">
              <div className="panel-head">
                <div>
                  <h3>Nearby R58 devices</h3>
                  <span>Devices discovered automatically on this LAN</span>
                </div>
                <div className="sync-status-wrap">
                  <span className={`pill ${autoSyncStatus?.running ? 'pill-ok' : 'pill-muted'}`}>
                    {autoSyncStatus?.running ? 'Auto Sync ON' : 'Auto Sync OFF'}
                  </span>
                  <button className="ghost-btn small-btn" onClick={() => window.r58.refreshNearbyDevices()}>↻ Find</button>
                </div>
              </div>

              <div className="auto-sync-strip">
                <div>
                  <strong>Automatic synchronization</strong>
                  <span>
                    {autoSyncStatus?.syncing
                      ? 'Syncing in the background…'
                      : `Checks every ${Math.round(Number(autoSyncStatus?.intervalMs ?? 30000) / 1000)} seconds.`}
                  </span>
                </div>
                <div className="small-muted">
                  {autoSyncStatus?.lastError
                    ? `Last attempt: ${autoSyncStatus.lastError}`
                    : autoSyncStatus?.lastSuccessAt
                      ? `Last success ${formatDate(autoSyncStatus.lastSuccessAt)}`
                      : 'Waiting for the first background sync.'}
                </div>
              </div>

              <div className="nearby-list">
                {nearbyDevices.length ? nearbyDevices.map(deviceItem => {
                  const isTrusted = trustedDevices.some(t => t.device_id === deviceItem.deviceId);
                  return (
                    <div className="nearby-row" key={deviceItem.deviceId}>
                      <div className="nearby-main">
                        <span className="nearby-dot" />
                        <div>
                          <strong>{deviceItem.deviceName}</strong>
                          <span className="mono">{deviceItem.address}:{deviceItem.port}</span>
                        </div>
                      </div>
                      <div className="nearby-actions">
                        <span className={`pill ${isTrusted ? 'pill-ok' : 'pill-muted'}`}>
                          {isTrusted ? 'Paired' : 'Not paired'}
                        </span>
                        {isTrusted && (
                          <>
                            <button className="secondary-btn small-btn" disabled={busy} onClick={() => syncSelectedDevice(deviceItem.address, deviceItem.deviceId)}>
                              Sync
                            </button>
                            <button
                              className="danger-btn small-btn"
                              disabled={busy}
                              onClick={() => forgetTrustedDevice(deviceItem.deviceId, deviceItem.deviceName)}
                            >
                              Forget
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                }) : (
                  <div className="empty nearby-empty">
                    No R58 devices discovered yet. Keep the Android R58 app open on the same Wi-Fi/LAN.
                  </div>
                )}
              </div>
            </div>

            <div className="panel pair-form">
              <div className="panel-head"><div><h3>Pair this PC with Android</h3><span>Same six-digit pairing flow as the existing R58 app</span></div></div>
              <div className="form-grid">
                <div><label>Android IP address</label><input className="field" value={pairHost} onChange={e => setPairHost(e.target.value)} placeholder="e.g. 192.168.1.25" /></div>
                <div><label>6-digit pairing code</label><input className="field" value={pairCode} onChange={e => setPairCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" inputMode="numeric" /></div>
              </div>
              <button className="primary-btn" onClick={pair} disabled={busy}>Pair with Android R58</button>
              <div className="help-text">Keep the Android R58 app open on the Device & Sync screen while pairing. Both devices should be on the same Wi-Fi/LAN.</div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function NavButton({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return <button className={`nav-btn ${active ? 'active' : ''}`} onClick={onClick}><span>{icon}</span>{label}</button>;
}

function Metric({ title, value }: { title: string; value: string | number }) {
  return <div className="metric-card"><span>{title}</span><strong>{value}</strong></div>;
}

function MiniInventory({ rows }: { rows: InventoryRow[] }) {
  return <div className="mini-list">{rows.length ? rows.map(row => <div className="mini-row" key={row.id}><div><strong>{row.item_name}</strong><span>{row.stock_id}</span></div><b>{Number(row.current_stock)} {row.unit}</b></div>) : <div className="empty">No inventory data yet. Run Sync Now.</div>}</div>;
}

function MiniTransactions({ rows }: { rows: TransactionRow[] }) {
  return <div className="mini-list">{rows.length ? rows.map(row => <div className="mini-row" key={row.id}><div><strong>{row.item_name}</strong><span>{row.transaction_type}</span></div><b className={Number(row.stock_delta) >= 0 ? 'delta-positive' : 'delta-negative'}>{Number(row.stock_delta) > 0 ? '+' : ''}{Number(row.stock_delta)} {row.unit}</b></div>) : <div className="empty">No transactions yet.</div>}</div>;
}

function TableInventory({ rows }: { rows: InventoryRow[] }) {
  return <table><thead><tr><th>Stock ID</th><th>Item</th><th>Old ID</th><th>Unit</th><th>Current Stock</th><th>Min</th><th>Status</th></tr></thead><tbody>{rows.map(row => { const low = Number(row.current_stock) <= Number(row.minimum_stock); return <tr key={row.id}><td className="mono">{row.stock_id}</td><td><strong>{row.item_name}</strong></td><td>{row.old_item_id || '—'}</td><td>{row.unit}</td><td><strong>{Number(row.current_stock)}</strong></td><td>{Number(row.minimum_stock)}</td><td><span className={`status ${low ? 'low' : 'ok'}`}>{low ? 'Low stock' : 'In stock'}</span></td></tr>; })}</tbody></table>;
}

function TableTransactions({ rows }: { rows: TransactionRow[] }) {
  return <table><thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Change</th><th>Department</th><th>Person</th><th>Remark</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{formatDate(row.timestamp)}</td><td><strong>{row.item_name}</strong><span className="sub-cell">{row.stock_id}</span></td><td>{row.transaction_type}</td><td className={Number(row.stock_delta) >= 0 ? 'delta-positive' : 'delta-negative'}>{Number(row.stock_delta) > 0 ? '+' : ''}{Number(row.stock_delta)} {row.unit}</td><td>{row.department_name || '—'}</td><td>{row.person_name || row.other_name || '—'}</td><td>{row.remark || '—'}</td></tr>)}</tbody></table>;
}
