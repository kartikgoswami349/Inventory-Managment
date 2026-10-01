import { useEffect, useState } from 'react';
import r58Logo from './assets/r58-logo.png';

type Page = 'dashboard' | 'inventory' | 'add-item' | 'edit-item' | 'transactions' | 'new-transaction' | 'departments' | 'audits' | 'data-tools' | 'sync';
type UpdateStatus = { state: string; message: string; percent?: number; version?: string };

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
  stock_after: number;
  department_name: string | null;
  person_name: string | null;
  other_name: string | null;
  remark: string | null;
  timestamp: string;
};

type TransactionDraftRow = InventoryRow & { count: number };

type AuditRow = {
  id: string;
  item_id: string;
  stock_id: string | null;
  item_name: string | null;
  unit: string | null;
  system_quantity: number;
  audited_quantity: number;
  variance: number;
  remark: string | null;
  timestamp: string;
  device_id: string;
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
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: 'idle', message: 'Checking update status…' });
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [editingItem, setEditingItem] = useState<InventoryRow | null>(null);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [itemToDelete, setItemToDelete] = useState<InventoryRow | null>(null);
  const [pairHost, setPairHost] = useState('');
  const [pairCode, setPairCode] = useState('');
  const [pcPairCode, setPcPairCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [syncHost, setSyncHost] = useState('');
  const [nextStockId, setNextStockId] = useState('');
  const [newItem, setNewItem] = useState({
    oldItemId: '',
    itemName: '',
    unit: 'Pcs',
    minimumStock: '0',
    openingQuantity: '0',
  });
  const [transactionType, setTransactionType] = useState<'ISSUED' | 'RECEIVED'>('ISSUED');
  const [transactionSearch, setTransactionSearch] = useState('');
  const [transactionCandidates, setTransactionCandidates] = useState<InventoryRow[]>([]);
  const [transactionDraft, setTransactionDraft] = useState<TransactionDraftRow[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [people, setPeople] = useState<Array<{ id: string; department_id: string; name: string }>>([]);
  const [managementPeople, setManagementPeople] = useState<Array<{ id: string; department_id: string; name: string }>>([]);
  const [managementDepartmentId, setManagementDepartmentId] = useState('');
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [newPersonName, setNewPersonName] = useState('');
  const [transactionDepartmentId, setTransactionDepartmentId] = useState('');
  const [transactionPersonId, setTransactionPersonId] = useState('');
  const [transactionOtherName, setTransactionOtherName] = useState('');
  const [transactionRemark, setTransactionRemark] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditCandidates, setAuditCandidates] = useState<InventoryRow[]>([]);
  const [auditItem, setAuditItem] = useState<InventoryRow | null>(null);
  const [auditedQuantity, setAuditedQuantity] = useState('');
  const [auditRemark, setAuditRemark] = useState('');

  async function refreshAll() {
    const [d, t, ts, db, inv, nearby, autoStatus, auditRows] = await Promise.all([
      window.r58.getDevice(),
      window.r58.getTrusted(),
      window.r58.getTrustedDevices(),
      window.r58.getDashboard(),
      window.r58.getInventory(search),
      window.r58.getNearbyDevices(),
      window.r58.getAutoSyncStatus(),
      window.r58.getAudits(300),
    ]);
    setDevice(d);
    setTrusted(t);
    setTrustedDevices(ts);
    setDashboard(db);
    setInventory(inv);
    setNearbyDevices(nearby);
    setAutoSyncStatus(autoStatus);
    setAudits(auditRows);
    setSyncHost(current => current || t?.last_host || '');
    setTransactions(await window.r58.getTransactions(300));
  }

  useEffect(() => { refreshAll().catch(error => setMessage(error?.message ?? String(error))); }, []);
  useEffect(() => {
    const unsubscribe = window.r58.onUpdateStatus(setUpdateStatus);
    window.r58.getUpdateStatus()
      .then(setUpdateStatus)
      .catch(error => setMessage(error?.message ?? String(error)));
    const onError = (event: ErrorEvent) => window.r58.reportRendererError({
      type: 'window.error',
      message: event.message,
      stack: event.error?.stack,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
    });
    const onUnhandledRejection = (event: PromiseRejectionEvent) => window.r58.reportRendererError({
      type: 'unhandledrejection',
      message: String(event.reason?.message ?? event.reason),
      stack: event.reason?.stack,
    });
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      unsubscribe();
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);
  useEffect(() => {
    const handle = setTimeout(() => {
      window.r58.getInventory(search).then(setInventory).catch(() => {});
    }, 220);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    if (page !== 'add-item') return;
    window.r58.getNextStockId()
      .then(setNextStockId)
      .catch(error => setMessage(error?.message ?? String(error)));
  }, [page]);

  useEffect(() => {
    if (page !== 'new-transaction') return;
    window.r58.getDepartments()
      .then(setDepartments)
      .catch(error => setMessage(error?.message ?? String(error)));
  }, [page]);

  useEffect(() => {
    if (page !== 'departments') return;
    window.r58.getDepartments()
      .then(rows => {
        setDepartments(rows);
        setManagementDepartmentId(current => rows.some(row => row.id === current) ? current : rows[0]?.id ?? '');
      })
      .catch(error => setMessage(error?.message ?? String(error)));
  }, [page]);

  useEffect(() => {
    if (page !== 'departments') return;
    if (!managementDepartmentId) {
      setManagementPeople([]);
      return;
    }
    window.r58.getPeopleByDepartment(managementDepartmentId)
      .then(setManagementPeople)
      .catch(error => setMessage(error?.message ?? String(error)));
  }, [page, managementDepartmentId]);

  useEffect(() => {
    if (page !== 'new-transaction') return;
    const handle = setTimeout(() => {
      window.r58.getInventory(transactionSearch)
        .then(setTransactionCandidates)
        .catch(error => setMessage(error?.message ?? String(error)));
    }, 220);
    return () => clearTimeout(handle);
  }, [page, transactionSearch]);

  useEffect(() => {
    if (page !== 'audits') return;
    const handle = setTimeout(() => {
      window.r58.getInventory(auditSearch)
        .then(setAuditCandidates)
        .catch(error => setMessage(error?.message ?? String(error)));
    }, 220);
    return () => clearTimeout(handle);
  }, [page, auditSearch]);

  useEffect(() => {
    if (page !== 'dashboard') return;
    Promise.all([
      window.r58.getDashboard(),
      window.r58.getInventory(''),
      window.r58.getTransactions(300),
    ]).then(([stats, rows, recent]) => {
      setDashboard(stats);
      setInventory(rows);
      setTransactions(recent);
    }).catch(error => setMessage(error?.message ?? String(error)));
  }, [page]);

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

  async function saveNewItem() {
    const minimumStock = Number(newItem.minimumStock);
    const openingQuantity = Number(newItem.openingQuantity);
    if (!Number.isFinite(minimumStock) || minimumStock < 0) {
      setMessage('Minimum stock must be zero or greater.');
      return;
    }
    if (!Number.isFinite(openingQuantity) || openingQuantity < 0) {
      setMessage('Opening quantity must be zero or greater.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const result = await window.r58.createInventoryItem({
        ...newItem,
        minimumStock,
        openingQuantity,
      });
      setNewItem({ oldItemId: '', itemName: '', unit: 'Pcs', minimumStock: '0', openingQuantity: '0' });
      setNextStockId(await window.r58.getNextStockId());
      setPage('inventory');
      setMessage(`Created ${newItem.itemName.trim()} as ${result.stockId}.`);
      await refreshAll();
    } catch (error: any) {
      setMessage(error?.message ?? String(error));
    } finally {
      setBusy(false);
    }
  }

  function startEditInventoryItem(item: InventoryRow) {
    setNewItem({
      oldItemId: item.old_item_id ?? '',
      itemName: item.item_name,
      unit: item.unit,
      minimumStock: String(item.minimum_stock),
      openingQuantity: '0',
    });
    setItemToDelete(null);
    setPage('edit-item');
  }

  async function saveEditedItem() {
    const minimumStock = Number(newItem.minimumStock);
    if (!editingItem || !Number.isFinite(minimumStock) || minimumStock < 0) {
      setMessage(!editingItem ? 'Select an inventory item to edit.' : 'Minimum stock must be zero or greater.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const result = await window.r58.updateInventoryItem({
        itemId: editingItem.id,
        oldItemId: newItem.oldItemId,
        itemName: newItem.itemName,
        unit: newItem.unit,
        minimumStock,
      });
      setEditingItem(null);
      setPage('inventory');
      setMessage(`Updated "${result.itemName}".`);
      await refreshAll();
    } catch (error: any) {
      setMessage(error?.message ?? String(error));
    } finally {
      setBusy(false);
    }
  }

  async function removeInventoryItem(item: InventoryRow) {
    setBusy(true);
    setMessage('');
    try {
      await window.r58.deactivateInventoryItem(item.id);
      setItemToDelete(null);
      setMessage(`"${item.item_name}" was removed from active inventory. Existing history was retained.`);
      await refreshAll();
    } catch (error: any) {
      setMessage(error?.message ?? String(error));
    } finally {
      setBusy(false);
    }
  }

  async function selectTransactionDepartment(departmentId: string) {
    setTransactionDepartmentId(departmentId);
    setTransactionPersonId('');
    setTransactionOtherName('');
    setPeople([]);
    if (!departmentId) return;
    try {
      setPeople(await window.r58.getPeopleByDepartment(departmentId));
    } catch (error: any) {
      setMessage(error?.message ?? String(error));
    }
  }

  async function addDepartment() {
    setBusy(true);
    setMessage('');
    try {
      const result = await window.r58.createDepartment(newDepartmentName);
      const rows = await window.r58.getDepartments();
      setDepartments(rows);
      setNewDepartmentName('');
      setManagementDepartmentId(result.id);
      setMessage(`Department "${result.name}" added.`);
    } catch (error: any) {
      setMessage(error?.message ?? String(error));
    } finally {
      setBusy(false);
    }
  }

  async function addPerson() {
    if (!managementDepartmentId) {
      setMessage('Select a department first.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const person = await window.r58.createPerson(managementDepartmentId, newPersonName);
      setManagementPeople(await window.r58.getPeopleByDepartment(managementDepartmentId));
      setNewPersonName('');
      setMessage(`Person "${person.name}" added.`);
    } catch (error: any) {
      setMessage(error?.message ?? String(error));
    } finally {
      setBusy(false);
    }
  }

  async function removePerson(personId: string, name: string) {
    if (!window.confirm(`Remove ${name} from future selections? Existing transaction history will remain unchanged.`)) return;
    setBusy(true);
    setMessage('');
    try {
      await window.r58.deactivatePerson(personId);
      setManagementPeople(await window.r58.getPeopleByDepartment(managementDepartmentId));
      setMessage(`${name} removed from future selections.`);
    } catch (error: any) {
      setMessage(error?.message ?? String(error));
    } finally {
      setBusy(false);
    }
  }

  async function removeDepartment() {
    const department = departments.find(row => row.id === managementDepartmentId);
    if (!department) return;
    if (!window.confirm(`Delete "${department.name}" and remove its people from future selections?\n\nExisting transaction history will remain unchanged.`)) return;
    setBusy(true);
    setMessage('');
    try {
      await window.r58.deactivateDepartment(department.id);
      const rows = await window.r58.getDepartments();
      setDepartments(rows);
      setManagementDepartmentId(rows[0]?.id ?? '');
      setMessage(`Department "${department.name}" deleted.`);
    } catch (error: any) {
      setMessage(error?.message ?? String(error));
    } finally {
      setBusy(false);
    }
  }

  function addOne(row: InventoryRow) {
    const existing = transactionDraft.find(item => item.id === row.id);
    const nextCount = (existing?.count ?? 0) + 1;
    if (transactionType === 'ISSUED' && nextCount > Number(row.current_stock)) {
      setMessage(`Insufficient stock. Available: ${Number(row.current_stock)} ${row.unit}.`);
      return;
    }
    setMessage('');
    setTransactionDraft(current => existing
      ? current.map(item => item.id === row.id ? { ...item, current_stock: row.current_stock, count: item.count + 1 } : item)
      : [...current, { ...row, count: 1 }]);
  }

  function removeOne(itemId: string) {
    setTransactionDraft(current => current.flatMap(item => {
      if (item.id !== itemId) return [item];
      return item.count > 1 ? [{ ...item, count: item.count - 1 }] : [];
    }));
  }

  function removeAll(itemId: string) {
    setTransactionDraft(current => current.filter(item => item.id !== itemId));
  }

  async function saveTransaction() {
    if (!transactionDepartmentId) {
      setMessage('Select a department.');
      return;
    }
    if (!transactionPersonId) {
      setMessage('Select a person.');
      return;
    }
    if (transactionPersonId === 'OTHER' && !transactionOtherName.trim()) {
      setMessage('Enter the other person name.');
      return;
    }
    if (!transactionDraft.length) {
      setMessage('Add at least one item to the transaction.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const result = await window.r58.createInventoryTransactions({
        type: transactionType,
        items: transactionDraft.map(item => ({ itemId: item.id, quantity: item.count })),
        departmentId: transactionDepartmentId,
        personId: transactionPersonId === 'OTHER' ? null : transactionPersonId,
        otherName: transactionPersonId === 'OTHER' ? transactionOtherName.trim() : null,
        remark: transactionRemark,
      });
      setTransactionDraft([]);
      setTransactionRemark('');
      setTransactionOtherName('');
      setTransactionPersonId('');
      setPage('transactions');
      setMessage(`${transactionType === 'ISSUED' ? 'Issue' : 'Receive'} saved for ${result.count} item${result.count === 1 ? '' : 's'}.`);
      await refreshAll();
    } catch (error: any) {
      setMessage(error?.message ?? String(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveAudit(adjustStock: boolean) {
    if (!auditItem) {
      setMessage('Select an active inventory item to audit.');
      return;
    }
    const quantity = auditedQuantity.trim() ? Number(auditedQuantity) : Number.NaN;
    if (!Number.isFinite(quantity) || quantity < 0) {
      setMessage('Enter a valid physical quantity of zero or greater.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const result = await window.r58.createAudit({
        itemId: auditItem.id,
        auditedQuantity: quantity,
        remark: auditRemark,
        adjustStock,
      });
      setMessage(result.adjusted
        ? `Audit saved. Stock adjusted by ${result.variance > 0 ? '+' : ''}${result.variance} ${auditItem.unit}.`
        : `Audit saved without changing live stock. Recorded variance: ${result.variance > 0 ? '+' : ''}${result.variance} ${auditItem.unit}.`);
      setAuditedQuantity('');
      setAuditRemark('');
      setAuditItem(null);
      await refreshAll();
    } catch (error: any) {
      setMessage(error?.message ?? String(error));
    } finally {
      setBusy(false);
    }
  }

  async function createBackupFile() {
    setBusy(true);
    setMessage('');
    try {
      const result = await window.r58.createDatabaseBackup();
      if (!result.canceled) setMessage(`Database backup created: ${result.filePath}`);
    } catch (error: any) {
      setMessage(error?.message ?? String(error));
    } finally {
      setBusy(false);
    }
  }

  async function restoreFromSqliteFile() {
    setBusy(true);
    setMessage('');
    try {
      const selected = await window.r58.inspectSqliteFile();
      if (selected.canceled || !selected.filePath || !selected.counts) return;
      const { counts } = selected;
      const confirmed = window.confirm(
        `Restore ${selected.fileName} and replace the current business database?\n\n` +
        `${counts.items} items\n${counts.transactions} transactions\n${counts.audits} audits\n${counts.departments} departments\n${counts.people} people\n\n` +
        `The PC device identity and trusted-device settings are preserved. A recovery database will be saved in the PC app data folder before restoring.`,
      );
      if (!confirmed) return;
      const restored = await window.r58.restoreSqliteFile(selected.filePath);
      setMessage(
        `Database restored from ${selected.fileName}. Recovery backup: ${restored.recoveryFileName}. ` +
        `${restored.counts.items} items, ${restored.counts.transactions} transactions, ${restored.counts.audits} audits.`,
      );
      await refreshAll();
    } catch (error: any) {
      setMessage(error?.message ?? String(error));
    } finally {
      setBusy(false);
    }
  }

  async function importSqliteFile() {
    setBusy(true);
    setMessage('');
    try {
      const selected = await window.r58.inspectSqliteFile();
      if (selected.canceled || !selected.filePath || !selected.counts) return;
      const { counts } = selected;
      const confirmed = window.confirm(
        `Import records from ${selected.fileName} into this PC?\n\n` +
        `${counts.items} items\n${counts.transactions} transactions\n${counts.audits} audits\n${counts.departments} departments\n${counts.people} people\n\n` +
        `This merges by record ID using R58 revision rules. Existing transaction and audit IDs are skipped; the current PC database is not replaced. Conflicting Stock IDs or QR codes will stop the import.`,
      );
      if (!confirmed) return;
      const imported = await window.r58.mergeSqliteFile(selected.filePath);
      const { result } = imported;
      setMessage(
        `SQLite import from ${result.sourceDeviceName} complete. Applied ${result.applied}, skipped ${result.skipped}; ` +
        `${result.items} items, ${result.transactions} transactions, ${result.audits} audits.`,
      );
      await refreshAll();
    } catch (error: any) {
      setMessage(error?.message ?? String(error));
    } finally {
      setBusy(false);
    }
  }

  async function exportExcelWorkbook() {
    setBusy(true);
    setMessage('');
    try {
      const result = await window.r58.exportExcel();
      if (!result.canceled) {
        const counts = result.counts!;
        setMessage(`Excel workbook exported: ${result.filePath}. ${counts.inventory} inventory rows, ${counts.transactions} transactions, ${counts.audits} audits.`);
      }
    } catch (error: any) {
      setMessage(error?.message ?? String(error));
    } finally {
      setBusy(false);
    }
  }

  async function exportManualJson() {
    setBusy(true);
    setMessage('');
    try {
      const result = await window.r58.exportManualJson();
      if (!result.canceled) {
        const counts = result.counts!;
        setMessage(`Manual JSON transfer exported: ${result.filePath}. ${counts.items} items, ${counts.transactions} transactions, ${counts.audits} audits.`);
      }
    } catch (error: any) {
      setMessage(error?.message ?? String(error));
    } finally {
      setBusy(false);
    }
  }

  async function importManualJson() {
    setBusy(true);
    setMessage('');
    try {
      const confirmed = window.confirm(
        'Select an R58 manual JSON transfer file to merge into this PC. Mutable records use R58 revision rules; duplicate transaction and audit IDs are skipped. This file transfer is not authenticated like a paired network sync.',
      );
      if (!confirmed) return;
      const result = await window.r58.importManualJson();
      if (result.canceled) return;
      setMessage(
        `JSON transfer from ${result.sourceDeviceName} complete. Applied ${result.applied}, skipped ${result.skipped}; ` +
        `${result.items} items, ${result.transactions} transactions, ${result.audits} audits.`,
      );
      await refreshAll();
    } catch (error: any) {
      setMessage(error?.message ?? String(error));
    } finally {
      setBusy(false);
    }
  }

  async function checkForUpdates() {
    setCheckingUpdates(true);
    setMessage('');
    try {
      setUpdateStatus(await window.r58.checkForUpdates());
    } catch (error: any) {
      setMessage(error?.message ?? String(error));
    } finally {
      setCheckingUpdates(false);
    }
  }

  async function installUpdate() {
    try {
      await window.r58.installUpdate();
    } catch (error: any) {
      setMessage(error?.message ?? String(error));
    }
  }

  async function openLogs() {
    try {
      await window.r58.openLogs();
    } catch (error: any) {
      setMessage(error?.message ?? String(error));
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-mark" src={r58Logo} alt="Shri Siddhdata Ashram logo" />
          <div>
            <div className="brand-title">R58 Inventory</div>
            <div className="brand-sub">Windows</div>
          </div>
        </div>
        <nav>
          <NavButton icon="⌂" label="Dashboard" active={page === 'dashboard'} onClick={() => setPage('dashboard')} />
          <NavButton icon="▦" label="Inventory" active={page === 'inventory' || page === 'add-item' || page === 'edit-item'} onClick={() => setPage('inventory')} />
          <NavButton icon="↕" label="Transactions" active={page === 'transactions' || page === 'new-transaction'} onClick={() => setPage('transactions')} />
          <NavButton icon="♙" label="Departments" active={page === 'departments'} onClick={() => setPage('departments')} />
          <NavButton icon="✓" label="Stock Audit" active={page === 'audits'} onClick={() => setPage('audits')} />
          <NavButton icon="⇄" label="Data Tools" active={page === 'data-tools'} onClick={() => setPage('data-tools')} />
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
            <h1>{page === 'dashboard' ? 'Dashboard' : page === 'inventory' ? 'Inventory' : page === 'add-item' ? 'Add New Item' : page === 'edit-item' ? 'Edit Inventory Item' : page === 'transactions' ? 'Transactions' : page === 'new-transaction' ? 'New Transaction' : page === 'departments' ? 'Department Management' : page === 'audits' ? 'Stock Audit' : page === 'data-tools' ? 'Backup & Data Tools' : 'Device & Sync'}</h1>
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
                <div className="hero-kicker">LIVE INVENTORY OVERVIEW</div>
                <h2>Your stock, at a glance.</h2>
                <p>{dashboard?.totalItems ?? '—'} active items · {dashboard?.totalStock ?? '—'} total stock. Local inventory operations stay available offline.</p>
                <button className="primary-btn" onClick={() => { setTransactionDraft([]); setPage('new-transaction'); }}>＋ Start Issue / Receive</button>
              </div>
              <div className="hero-status">
                <div className="status-circle">✓</div>
                <strong>{trusted ? `Paired with ${trusted.device_name}` : 'No Android device paired'}</strong>
                <span>{trusted?.last_sync_at ? `Last sync ${formatDate(trusted.last_sync_at)}` : 'Pair an Android R58 device to start syncing.'}</span>
              </div>
            </div>

            <div className="dashboard-section-head">
              <div><h2>Inventory Health</h2><span>{dashboard?.totalItems ?? '—'} active items</span></div>
            </div>
            <div className="health-grid">
              <HealthMetric title="In Stock" value={dashboard?.inStock ?? '—'} kind="healthy" />
              <HealthMetric title="Low Stock" value={dashboard?.lowStock ?? '—'} kind="warning" />
              <HealthMetric title="Out of Stock" value={dashboard?.outOfStock ?? '—'} kind="danger" />
            </div>

            <div className="dashboard-section-head">
              <div><h2>Today's Activity</h2><span>Transactions and audits since local midnight</span></div>
            </div>
            <div className="activity-grid">
              <ActivityMetric title="Transactions" value={dashboard?.transactionsToday ?? '—'} symbol="▤" />
              <ActivityMetric title="Issued" value={dashboard?.issuedToday ?? '—'} symbol="↑" />
              <ActivityMetric title="Received" value={dashboard?.receivedToday ?? '—'} symbol="↓" />
              <ActivityMetric title="Audits" value={dashboard?.auditsToday ?? '—'} symbol="✓" />
            </div>

            <div className="dashboard-section-head">
              <div><h2>Quick Actions</h2><span>Jump to a common task</span></div>
            </div>
            <div className="quick-actions-grid">
              <QuickAction title="Inventory" subtitle="View all stock" symbol="▦" onClick={() => setPage('inventory')} />
              <QuickAction title="Audit" subtitle="Count physical stock" symbol="✓" onClick={() => setPage('audits')} />
              <QuickAction title="Transactions" subtitle="History and ledger" symbol="↕" onClick={() => setPage('transactions')} />
              <QuickAction title="Departments & People" subtitle="Manage transaction recipients" symbol="♙" onClick={() => setPage('departments')} />
              <QuickAction title="Backup & Restore" subtitle="Protect inventory data" symbol="⇄" onClick={() => setPage('data-tools')} />
              <QuickAction title="Device & Sync" subtitle="Connected devices" symbol="◉" onClick={() => setPage('sync')} />
            </div>

            <div className="two-col">
              <div className="panel">
                <div className="panel-head"><div><h3>Inventory snapshot</h3><span>Current active stock</span></div><button className="text-btn" onClick={() => setPage('inventory')}>View all →</button></div>
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
            <div className="toolbar inventory-toolbar panel">
              <div className="search-box"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item name, Stock ID, old item ID" /></div>
              <div className="toolbar-note">{inventory.length} shown</div>
              <button className="primary-btn" onClick={() => setPage('add-item')}>＋ Add New Item</button>
            </div>
            <div className="panel table-panel">
              <TableInventory
                rows={inventory}
                onEdit={startEditInventoryItem}
                onDelete={setItemToDelete}
                busy={busy}
              />
            </div>
            {itemToDelete && (
              <div className="confirm-backdrop" role="presentation">
                <div className="panel confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-item-title">
                  <div className="panel-head"><div><h3 id="delete-item-title">Delete inventory item?</h3><span>{itemToDelete.stock_id} · {itemToDelete.item_name}</span></div></div>
                  <p>It will be removed from active inventory and unavailable for future transactions. Existing transaction and audit history will be retained.</p>
                  <div className="form-actions">
                    <button className="secondary-btn" onClick={() => setItemToDelete(null)} disabled={busy}>Cancel</button>
                    <button className="danger-btn" onClick={() => void removeInventoryItem(itemToDelete)} disabled={busy}>{busy ? 'Deleting…' : 'Delete Item'}</button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {(page === 'add-item' || page === 'edit-item') && (
          <section className="content">
            <div className="panel item-form-panel">
              <div className="panel-head">
                <div><h3>{page === 'edit-item' ? 'Edit inventory item' : 'Create inventory item'}</h3><span>{page === 'edit-item' ? 'Update item details. Stock quantity changes are recorded through transactions.' : 'New items receive the next sequential Stock ID.'}</span></div>
                <button className="text-btn" onClick={() => setPage('inventory')}>← Back to Inventory</button>
              </div>
              {page === 'edit-item' ? <div className="next-stock-card"><span className="small-label">STOCK ID</span><strong>{editingItem?.stock_id}</strong><span>Stock ID and current quantity cannot be changed here.</span></div> : <div className="next-stock-card">
                <span className="small-label">NEXT STOCK / QR ID</span>
                <strong>{nextStockId || 'Loading…'}</strong>
                <span>Generated automatically when saved</span>
              </div>}
              <div className="form-grid item-form-grid">
                <div>
                  <label htmlFor="old-item-id">Existing / Group Item ID</label>
                  <input id="old-item-id" className="field" value={newItem.oldItemId} onChange={event => setNewItem(current => ({ ...current, oldItemId: event.target.value }))} placeholder="Optional, e.g. R58-PB-067" />
                  <span className="form-help">This ID can be shared by items in the same group.</span>
                </div>
                <div>
                  <label htmlFor="item-name">Item Name *</label>
                  <input id="item-name" className="field" value={newItem.itemName} onChange={event => setNewItem(current => ({ ...current, itemName: event.target.value }))} placeholder='e.g. PVC Elbow 3"' />
                </div>
                <div>
                  <label htmlFor="item-unit">Unit *</label>
                  <input id="item-unit" className="field" value={newItem.unit} onChange={event => setNewItem(current => ({ ...current, unit: event.target.value }))} placeholder="Pcs / Roll / Kg / Meter" />
                </div>
                {page === 'add-item' && <div>
                  <label htmlFor="opening-quantity">Opening Quantity</label>
                  <input id="opening-quantity" className="field" type="number" min="0" step="any" value={newItem.openingQuantity} onChange={event => setNewItem(current => ({ ...current, openingQuantity: event.target.value }))} />
                </div>}
                <div>
                  <label htmlFor="minimum-stock">Minimum Stock</label>
                  <input id="minimum-stock" className="field" type="number" min="0" step="any" value={newItem.minimumStock} onChange={event => setNewItem(current => ({ ...current, minimumStock: event.target.value }))} />
                </div>
              </div>
              <div className="form-footnote">{page === 'edit-item' ? 'To change this item’s quantity, create a Receive or Issue transaction or perform a stock audit.' : 'Opening quantity is recorded once as an opening ledger entry. Future stock changes should use Receive or Issue.'}</div>
              <div className="form-actions">
                <button className="secondary-btn" onClick={() => setPage('inventory')} disabled={busy}>Cancel</button>
                <button className="primary-btn" onClick={page === 'edit-item' ? saveEditedItem : saveNewItem} disabled={busy || (page === 'add-item' && !nextStockId)}>{busy ? (page === 'edit-item' ? 'Saving…' : 'Creating Item…') : (page === 'edit-item' ? 'Save Changes' : 'Create Item')}</button>
              </div>
            </div>
          </section>
        )}

        {page === 'transactions' && (
          <section className="content">
            <div className="panel table-panel">
              <div className="panel-head">
                <div><h3>Transaction history</h3><span>Local and synchronized inventory ledger</span></div>
                <button className="primary-btn" onClick={() => setPage('new-transaction')}>＋ New Transaction</button>
              </div>
              <TableTransactions rows={transactions} />
            </div>
          </section>
        )}

        {page === 'new-transaction' && (
          <section className="content transaction-page">
            <div className="panel">
              <div className="panel-head">
                <div><h3>Issue or Receive Stock</h3><span>Choose the transaction details and add item quantities.</span></div>
                <button className="text-btn" onClick={() => setPage('transactions')}>← Transaction History</button>
              </div>
              <div className="transaction-form">
                <div className="transaction-mode">
                  <button className={`mode-btn ${transactionType === 'ISSUED' ? 'selected' : ''}`} onClick={() => setTransactionType('ISSUED')}>Issue</button>
                  <button className={`mode-btn ${transactionType === 'RECEIVED' ? 'selected' : ''}`} onClick={() => setTransactionType('RECEIVED')}>Receive</button>
                </div>
                <div className="form-grid transaction-fields">
                  <div>
                    <label htmlFor="transaction-department">Department *</label>
                    <select id="transaction-department" className="field" value={transactionDepartmentId} onChange={event => void selectTransactionDepartment(event.target.value)}>
                      <option value="">Select Department</option>
                      {departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="transaction-person">Person *</label>
                    <select id="transaction-person" className="field" value={transactionPersonId} disabled={!transactionDepartmentId} onChange={event => setTransactionPersonId(event.target.value)}>
                      <option value="">Select Person</option>
                      {people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
                      {transactionDepartmentId && <option value="OTHER">Other</option>}
                    </select>
                  </div>
                  {transactionPersonId === 'OTHER' && (
                    <div>
                      <label htmlFor="transaction-other-name">Other Person Name *</label>
                      <input id="transaction-other-name" className="field" value={transactionOtherName} onChange={event => setTransactionOtherName(event.target.value)} />
                    </div>
                  )}
                  <div>
                    <label htmlFor="transaction-remark">Remark</label>
                    <input id="transaction-remark" className="field" value={transactionRemark} onChange={event => setTransactionRemark(event.target.value)} placeholder="Optional transaction note" />
                  </div>
                </div>
              </div>
            </div>

            <div className="panel item-picker">
              <div className="panel-head"><div><h3>Add Items</h3><span>Search by item name, Stock ID, or old item ID.</span></div></div>
              <div className="picker-search">
                <div className="search-box"><span>⌕</span><input value={transactionSearch} onChange={event => setTransactionSearch(event.target.value)} placeholder="Search inventory" /></div>
              </div>
              <div className="pick-list">
                {transactionCandidates.map(item => (
                  <div className="pick-row" key={item.id}>
                    <div><strong>{item.item_name}</strong><span>{item.stock_id} · Available: {Number(item.current_stock)} {item.unit}</span></div>
                    <button className="secondary-btn small-btn" onClick={() => addOne(item)} disabled={busy || (transactionType === 'ISSUED' && Number(item.current_stock) <= 0)}>Add One</button>
                  </div>
                ))}
                {!transactionCandidates.length && <div className="empty">No matching active items.</div>}
              </div>
            </div>

            <div className="panel draft-panel">
              <div className="panel-head"><div><h3>Items in this transaction</h3><span>One ledger entry will be saved for each item.</span></div></div>
              {transactionDraft.length ? (
                <div className="draft-list">
                  {transactionDraft.map(item => (
                    <div className="draft-row" key={item.id}>
                      <div className="draft-item"><strong>{item.item_name}</strong><span>{item.stock_id} · {Number(item.current_stock)} {item.unit} available</span></div>
                      <div className="draft-quantity">{item.count} {item.unit}</div>
                      <div className="item-quantity-controls">
                        <button className="secondary-btn small-btn" onClick={() => addOne(item)} disabled={busy || (transactionType === 'ISSUED' && item.count >= Number(item.current_stock))}>Add One</button>
                        <button className="secondary-btn small-btn" onClick={() => removeOne(item.id)} disabled={busy}>Remove One</button>
                        <button className="danger-btn small-btn" onClick={() => removeAll(item.id)} disabled={busy}>Remove All</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div className="empty draft-empty">No items added yet.</div>}
              <div className="form-actions">
                <button className="secondary-btn" onClick={() => setPage('transactions')} disabled={busy}>Cancel</button>
                <button className="primary-btn" onClick={saveTransaction} disabled={busy || !transactionDraft.length}>{busy ? 'Saving…' : `Save ${transactionType === 'ISSUED' ? 'Issue' : 'Receive'}`}</button>
              </div>
            </div>
          </section>
        )}

        {page === 'departments' && (
          <section className="content department-page">
            <div className="department-layout">
              <div className="panel">
                <div className="panel-head">
                  <div><h3>Departments</h3><span>Create and select transaction departments.</span></div>
                </div>
                <div className="department-add-row">
                  <input className="field" aria-label="New department name" value={newDepartmentName} onChange={event => setNewDepartmentName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void addDepartment(); }} placeholder="Department name" />
                  <button className="primary-btn" onClick={() => void addDepartment()} disabled={busy || !newDepartmentName.trim()}>＋ Add</button>
                </div>
                <div className="department-list">
                  {departments.map(department => (
                    <button key={department.id} className={`department-option ${managementDepartmentId === department.id ? 'selected' : ''}`} onClick={() => setManagementDepartmentId(department.id)}>
                      <span>{department.name}</span>
                      <span>{managementDepartmentId === department.id ? 'Selected' : '›'}</span>
                    </button>
                  ))}
                  {!departments.length && <div className="empty">No active departments yet. Add one to get started.</div>}
                </div>
              </div>

              <div className="panel">
                <div className="panel-head">
                  <div><h3>{departments.find(row => row.id === managementDepartmentId)?.name ?? 'People'}</h3><span>Manage people available for Issue / Receive transactions.</span></div>
                  {managementDepartmentId && <button className="danger-btn small-btn" onClick={() => void removeDepartment()} disabled={busy}>Delete Department</button>}
                </div>
                {managementDepartmentId ? (
                  <>
                    <div className="department-add-row">
                      <input className="field" aria-label="New person name" value={newPersonName} onChange={event => setNewPersonName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void addPerson(); }} placeholder="Person name" />
                      <button className="primary-btn" onClick={() => void addPerson()} disabled={busy || !newPersonName.trim()}>＋ Add Person</button>
                    </div>
                    <div className="people-list">
                      {managementPeople.map(person => (
                        <div className="person-row" key={person.id}>
                          <span className="person-avatar">{person.name.charAt(0).toUpperCase()}</span>
                          <strong>{person.name}</strong>
                          <button className="text-btn" onClick={() => void removePerson(person.id, person.name)} disabled={busy}>Remove</button>
                        </div>
                      ))}
                      {!managementPeople.length && <div className="empty">No people in this department yet.</div>}
                    </div>
                  </>
                ) : (
                  <div className="empty department-empty">Select a department to add or manage its people.</div>
                )}
              </div>
            </div>
            <div className="form-footnote">Deleting departments or people removes them from future selections only. Existing transaction records remain unchanged.</div>
          </section>
        )}

        {page === 'audits' && (
          <section className="content audit-page">
            <div className="panel">
              <div className="panel-head">
                <div><h3>Physical stock count</h3><span>Search for an item, record what you counted, and review the variance.</span></div>
              </div>
              <div className="audit-picker">
                <div className="search-box"><span>⌕</span><input value={auditSearch} onChange={event => setAuditSearch(event.target.value)} placeholder="Search item name, Stock ID, or old item ID" /></div>
                <div className="audit-candidates">
                  {auditCandidates.map(item => (
                    <button className={`audit-candidate ${auditItem?.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => {
                      setAuditItem(item);
                      setAuditedQuantity('');
                      setAuditRemark('');
                    }}>
                      <span><strong>{item.item_name}</strong><small>{item.stock_id}</small></span>
                      <span className="audit-current-stock">System: {Number(item.current_stock)} {item.unit}</span>
                    </button>
                  ))}
                  {!auditCandidates.length && <div className="empty">No matching active items.</div>}
                </div>
              </div>

              {auditItem && (
                <div className="audit-form">
                  <div className="audit-item-summary">
                    <div><span className="small-label">SELECTED ITEM</span><strong>{auditItem.item_name}</strong><span>{auditItem.stock_id}</span></div>
                    <div className="audit-system-quantity"><span className="small-label">SYSTEM QUANTITY</span><strong>{Number(auditItem.current_stock)} <small>{auditItem.unit}</small></strong></div>
                  </div>
                  <div className="form-grid audit-fields">
                    <div>
                      <label htmlFor="audited-quantity">Physical / Audited Quantity *</label>
                      <input id="audited-quantity" className="field" type="number" min="0" step="any" value={auditedQuantity} onChange={event => setAuditedQuantity(event.target.value)} placeholder="Enter counted quantity" />
                    </div>
                    <div>
                      <label htmlFor="audit-remark">Audit Remark</label>
                      <input id="audit-remark" className="field" value={auditRemark} onChange={event => setAuditRemark(event.target.value)} placeholder="Optional explanation" />
                    </div>
                  </div>
                  {auditedQuantity.trim() && Number.isFinite(Number(auditedQuantity)) && Number(auditedQuantity) >= 0 && (
                    <div className={`audit-variance ${Number(auditedQuantity) === Number(auditItem.current_stock) ? 'matched' : 'different'}`}>
                      <span className="small-label">VARIANCE</span>
                      <strong>{Number(auditedQuantity) - Number(auditItem.current_stock) > 0 ? '+' : ''}{Number(auditedQuantity) - Number(auditItem.current_stock)} {auditItem.unit}</strong>
                      <span>{Number(auditedQuantity) === Number(auditItem.current_stock)
                        ? 'Physical stock matches system stock.'
                        : Number(auditedQuantity) < Number(auditItem.current_stock)
                          ? `${Number(auditItem.current_stock) - Number(auditedQuantity)} ${auditItem.unit} less than system stock.`
                          : `${Number(auditedQuantity) - Number(auditItem.current_stock)} ${auditItem.unit} more than system stock.`}</span>
                    </div>
                  )}
                  <div className="audit-actions">
                    <button className="secondary-btn" onClick={() => { setAuditItem(null); setAuditedQuantity(''); setAuditRemark(''); }} disabled={busy}>Cancel</button>
                    {Number(auditedQuantity) === Number(auditItem.current_stock) && auditedQuantity.trim() ? (
                      <button className="primary-btn" onClick={() => saveAudit(false)} disabled={busy || !auditedQuantity.trim()}>{busy ? 'Saving…' : 'Save Audit'}</button>
                    ) : (
                      <>
                        <button className="secondary-btn" onClick={() => saveAudit(false)} disabled={busy || !auditedQuantity.trim() || !Number.isFinite(Number(auditedQuantity)) || Number(auditedQuantity) < 0}>{busy ? 'Saving…' : 'Save Audit Only'}</button>
                        <button className="primary-btn" onClick={() => saveAudit(true)} disabled={busy || !auditedQuantity.trim() || !Number.isFinite(Number(auditedQuantity)) || Number(auditedQuantity) < 0}>{busy ? 'Saving…' : 'Save & Adjust Stock'}</button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="panel table-panel">
              <div className="panel-head"><div><h3>Audit History</h3><span>Immutable audit records from this PC and synchronized R58 devices</span></div><span className="toolbar-note">{audits.length} shown</span></div>
              <TableAudits rows={audits} />
            </div>
          </section>
        )}

        {page === 'data-tools' && (
          <section className="content data-tools-page">
            <div className="data-safety-banner">
              <span className="data-safety-icon">✓</span>
              <div><strong>Protect your R58 data</strong><span>SQLite backups include inventory, departments, people, transactions, and audits. Restores create a recovery copy first.</span></div>
            </div>

            <div className="data-tools-grid">
              <DataToolCard
                title="Backup to File"
                description="Save a complete, portable SQLite backup to a location you choose."
                buttonLabel="Create SQLite Backup"
                onClick={createBackupFile}
                disabled={busy}
              />
              <DataToolCard
                title="Restore from File"
                description="Replace current business data with an R58 SQLite backup. A pre-restore recovery file is created in the PC app data folder."
                buttonLabel="Select Backup to Restore"
                onClick={restoreFromSqliteFile}
                disabled={busy}
                danger
              />
              <DataToolCard
                title="SQLite Import"
                description="Merge records from another R58 database by ID and revision, without replacing this PC's database or device settings."
                buttonLabel="Import SQLite Database"
                onClick={importSqliteFile}
                disabled={busy}
              />
              <DataToolCard
                title="Excel Export"
                description="Export Inventory, Transactions, and Audits as separate sheets in one workbook."
                buttonLabel="Export Excel Workbook"
                onClick={exportExcelWorkbook}
                disabled={busy}
              />
              <DataToolCard
                title="Manual JSON Transfer"
                description="Move R58 sync packets between devices using a file. Imported files merge using R58 conflict rules; this file workflow does not authenticate the sender."
                buttonLabel="Export JSON Transfer"
                secondaryLabel="Import JSON Transfer"
                onClick={exportManualJson}
                onSecondaryClick={importManualJson}
                disabled={busy}
              />
            </div>

            <div className="data-tools-note">
              <strong>Restore and import are different</strong>
              <span>Restore replaces inventory and ledger data. SQLite Import and JSON Transfer merge records while preserving this PC's local device identity and trusted-device configuration.</span>
            </div>
          </section>
        )}

        {page === 'sync' && (
          <section className="content sync-page">
            <div className="panel release-tools">
              <div>
                <span className="small-label">APPLICATION SUPPORT</span>
                <h3>Updates & diagnostics</h3>
                <p>{updateStatus.message}</p>
                {updateStatus.state === 'downloading' && <progress max="100" value={updateStatus.percent ?? 0} />}
              </div>
              <div className="release-actions">
                <button className="secondary-btn" onClick={() => void checkForUpdates()} disabled={checkingUpdates || updateStatus.state === 'checking'}>
                  {checkingUpdates || updateStatus.state === 'checking' ? 'Checking…' : 'Check for Updates'}
                </button>
                {updateStatus.state === 'downloaded' && <button className="primary-btn" onClick={() => void installUpdate()}>Restart to Install</button>}
                <button className="ghost-btn" onClick={() => void openLogs()}>Open Error Logs</button>
              </div>
            </div>
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

function HealthMetric({ title, value, kind }: { title: string; value: string | number; kind: 'healthy' | 'warning' | 'danger' }) {
  return <div className={`health-card ${kind}`}><span>{title}</span><strong>{value}</strong></div>;
}

function ActivityMetric({ title, value, symbol }: { title: string; value: string | number; symbol: string }) {
  const kind = title === 'Issued' ? 'issued' : title === 'Received' ? 'received' : title === 'Audits' ? 'audits' : 'transactions';
  return <div className="activity-metric"><span className={`activity-symbol ${kind}`}>{symbol}</span><div><strong>{value}</strong><span>{title}</span></div></div>;
}

function QuickAction({ title, subtitle, symbol, onClick }: { title: string; subtitle: string; symbol: string; onClick: () => void }) {
  const kind = title.startsWith('Inventory') ? 'inventory' : title.startsWith('Audit') ? 'audit' : title.startsWith('Transactions') ? 'transactions' : title.startsWith('Departments') ? 'departments' : title.startsWith('Backup') ? 'backup' : 'sync';
  return <button className="quick-action" onClick={onClick}><span className={`quick-action-icon ${kind}`}>{symbol}</span><span className="quick-action-copy"><strong>{title}</strong><small>{subtitle}</small></span><span className="quick-action-arrow">›</span></button>;
}

function DataToolCard({ title, description, buttonLabel, onClick, secondaryLabel, onSecondaryClick, disabled, danger = false }: {
  title: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
  secondaryLabel?: string;
  onSecondaryClick?: () => void;
  disabled: boolean;
  danger?: boolean;
}) {
  return (
    <div className="panel data-tool-card">
      <div><h3>{title}</h3><p>{description}</p></div>
      <div className="data-tool-actions">
        <button className={danger ? 'danger-btn' : 'primary-btn'} onClick={onClick} disabled={disabled}>{buttonLabel}</button>
        {secondaryLabel && onSecondaryClick && <button className="secondary-btn" onClick={onSecondaryClick} disabled={disabled}>{secondaryLabel}</button>}
      </div>
    </div>
  );
}

function MiniInventory({ rows }: { rows: InventoryRow[] }) {
  return <div className="mini-list">{rows.length ? rows.map(row => <div className="mini-row" key={row.id}><div><strong>{row.item_name}</strong><span>{row.stock_id}</span></div><b>{Number(row.current_stock)} {row.unit}</b></div>) : <div className="empty">No inventory data yet. Run Sync Now.</div>}</div>;
}

function MiniTransactions({ rows }: { rows: TransactionRow[] }) {
  return <div className="mini-list">{rows.length ? rows.map(row => <div className="mini-row" key={row.id}><div><strong>{row.item_name}</strong><span>{row.transaction_type}</span></div><b className={Number(row.stock_delta) >= 0 ? 'delta-positive' : 'delta-negative'}>{Number(row.stock_delta) > 0 ? '+' : ''}{Number(row.stock_delta)} {row.unit}</b></div>) : <div className="empty">No transactions yet.</div>}</div>;
}

function TableInventory({ rows, onEdit, onDelete, busy }: { rows: InventoryRow[]; onEdit: (item: InventoryRow) => void; onDelete: (item: InventoryRow) => void; busy: boolean }) {
  return <table><thead><tr><th>Stock ID</th><th>Item</th><th>Old ID</th><th>Unit</th><th>Current Stock</th><th>Min</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map(row => { const low = Number(row.current_stock) <= Number(row.minimum_stock); return <tr key={row.id}><td className="mono">{row.stock_id}</td><td><strong>{row.item_name}</strong></td><td>{row.old_item_id || '—'}</td><td>{row.unit}</td><td><strong>{Number(row.current_stock)}</strong></td><td>{Number(row.minimum_stock)}</td><td><span className={`status ${low ? 'low' : 'ok'}`}>{low ? 'Low stock' : 'In stock'}</span></td><td><div className="inventory-actions"><button className="secondary-btn small-btn" onClick={() => onEdit(row)} disabled={busy}>Edit</button><button className="danger-btn small-btn" onClick={() => onDelete(row)} disabled={busy}>Delete</button></div></td></tr>; })}{!rows.length && <tr><td colSpan={8} className="empty">No active inventory items.</td></tr>}</tbody></table>;
}

function TableTransactions({ rows }: { rows: TransactionRow[] }) {
  return <table><thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Change</th><th>Stock After</th><th>Department</th><th>Person</th><th>Remark</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{formatDate(row.timestamp)}</td><td><strong>{row.item_name}</strong><span className="sub-cell">{row.stock_id}</span></td><td>{row.transaction_type}</td><td className={Number(row.stock_delta) >= 0 ? 'delta-positive' : 'delta-negative'}>{Number(row.stock_delta) > 0 ? '+' : ''}{Number(row.stock_delta)} {row.unit}</td><td><strong>{Number(row.stock_after)} {row.unit}</strong></td><td>{row.department_name || '—'}</td><td>{row.person_name || row.other_name || '—'}</td><td>{row.remark || '—'}</td></tr>)}</tbody></table>;
}

function TableAudits({ rows }: { rows: AuditRow[] }) {
  return <table><thead><tr><th>Date</th><th>Item</th><th>System Qty</th><th>Physical Qty</th><th>Variance</th><th>Remark</th></tr></thead><tbody>
    {rows.map(row => <tr key={row.id}>
      <td>{formatDate(row.timestamp)}</td>
      <td><strong>{row.item_name || 'Unknown item'}</strong><span className="sub-cell">{row.stock_id || row.item_id}</span></td>
      <td>{Number(row.system_quantity)} {row.unit || ''}</td>
      <td>{Number(row.audited_quantity)} {row.unit || ''}</td>
      <td className={Number(row.variance) === 0 ? 'delta-positive' : Number(row.variance) > 0 ? 'delta-positive' : 'delta-negative'}>{Number(row.variance) > 0 ? '+' : ''}{Number(row.variance)} {row.unit || ''}</td>
      <td>{row.remark || '—'}</td>
    </tr>)}
    {!rows.length && <tr><td colSpan={6} className="empty">No audits recorded yet.</td></tr>}
  </tbody></table>;
}
