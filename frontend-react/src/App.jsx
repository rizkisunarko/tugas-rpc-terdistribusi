import React, { useState, useEffect } from 'react';

const GATEWAY_URL = 'http://localhost:8000/api';

export default function App() {
  const [produkList, setProdukList] = useState([]);
  const [orderList, setOrderList] = useState([]);
  const [selectedProdukId, setSelectedProdukId] = useState('1');
  const [jumlah, setJumlah] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [activeJob, setActiveJob] = useState(null);

  useEffect(() => {
    fetchProduk();
    fetchOrder();
  }, []);

  const fetchProduk = async () => {
    try {
      const res = await fetch(`${GATEWAY_URL}/produk`);
      const data = await res.json();
      if (Array.isArray(data)) setProdukList(data);
    } catch (err) {
      console.error('Gagal mengambil daftar produk:', err);
    }
  };

  const fetchOrder = async () => {
    try {
      const res = await fetch(`${GATEWAY_URL}/order`);
      const data = await res.json();
      if (Array.isArray(data)) setOrderList(data);
    } catch (err) {
      console.error('Gagal mengambil daftar order:', err);
    }
  };

  // Order Sync (POST /api/order/sync)
  const handleOrderSync = async () => {
    setLoading(true);
    setStatusMessage({ type: 'info', text: 'Mengirim order synchronous (delay 200ms)...' });
    try {
      const res = await fetch(`${GATEWAY_URL}/order/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_produk: selectedProdukId, jumlah })
      });
      const data = await res.json();

      if (res.ok && !data.code) {
        setStatusMessage({
          type: 'success',
          text: `Order Sync Sukses! ID: #${data.id}, Subtotal: Rp ${data.subtotal?.toLocaleString()}, Diskon ML (${data.diskon_persen}%): -Rp ${data.total_diskon?.toLocaleString()}, Total Bayar: Rp ${data.total?.toLocaleString()}`
        });
        fetchProduk();
        fetchOrder();
      } else {
        setStatusMessage({
          type: 'error',
          text: `Error ${res.status}: ${data.message || data.error || 'Gagal membuat order'}`
        });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Gagal terhubung ke Express Gateway' });
    } finally {
      setLoading(false);
    }
  };

  // Order Async (POST /api/order/async) -> Polling tiap 500ms
  const handleOrderAsync = async () => {
    setLoading(true);
    setStatusMessage({ type: 'info', text: 'Mengirim order asynchronous...' });
    try {
      const res = await fetch(`${GATEWAY_URL}/order/async`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_produk: selectedProdukId, jumlah })
      });
      const data = await res.json();

      if (res.status === 202) {
        setActiveJob(data);
        setStatusMessage({
          type: 'info',
          text: `Job 202 Accepted (Job ID: ${data.jobId}). Memulai polling status per 500ms...`
        });
        pollJobStatus(data.jobId);
      } else {
        setLoading(false);
        setStatusMessage({ type: 'error', text: `Error ${res.status}: ${data.error || 'Gagal membuat async job'}` });
      }
    } catch (err) {
      setLoading(false);
      setStatusMessage({ type: 'error', text: 'Gagal terhubung ke Express Gateway' });
    }
  };

  const pollJobStatus = (jobId) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${GATEWAY_URL}/order/status/${jobId}`);
        const jobData = await res.json();

        setActiveJob(jobData);

        if (jobData.status === 'done' || jobData.status === 'completed') {
          clearInterval(interval);
          setLoading(false);
          setStatusMessage({
            type: 'success',
            text: `Async Order Selesai! ID: #${jobData.result.id}, Total Bayar: Rp ${jobData.result.total?.toLocaleString()}`
          });
          fetchProduk();
          fetchOrder();
        } else if (jobData.status === 'error' || jobData.status === 'failed') {
          clearInterval(interval);
          setLoading(false);
          setStatusMessage({
            type: 'error',
            text: `Async Order Gagal (HTTP ${jobData.httpStatus || 400}): ${jobData.error?.message || 'Terjadi kesalahan'}`
          });
        }
      } catch (err) {
        clearInterval(interval);
        setLoading(false);
        setStatusMessage({ type: 'error', text: 'Gagal melakukan polling status job' });
      }
    }, 500);
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Toko Online Mini</h1>
        <p>Arsitektur Web 1: Node.js Express Gateway + React Vite UI</p>
        <div className="arch-badge">
          <span>React (Frontend :3000)</span> &rarr;
          <span>Express Gateway (:8000)</span> &rarr;
          <span>Python (:5001) / PHP (:5002)</span>
        </div>
      </header>

      <div className="grid-2">
        {/* Tabel / Kartu Daftar Produk */}
        <div className="card">
          <div className="card-title">
            <span>Daftar Produk</span>
            <button className="btn btn-sync" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={fetchProduk}>
              Refresh
            </button>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nama</th>
                  <th>Harga</th>
                  <th>Stok</th>
                </tr>
              </thead>
              <tbody>
                {produkList.map((p) => (
                  <tr key={p.id}>
                    <td>#{p.id}</td>
                    <td style={{ fontWeight: 600 }}>{p.nama}</td>
                    <td style={{ color: '#06b6d4' }}>Rp {p.harga.toLocaleString()}</td>
                    <td>
                      <span className="product-stock">{p.stok} unit</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Form Buat Order */}
        <div className="card">
          <div className="card-title">Form Order Baru</div>
          <div className="form-group">
            <label htmlFor="select-produk">Pilih Produk:</label>
            <select
              id="select-produk"
              value={selectedProdukId}
              onChange={(e) => setSelectedProdukId(e.target.value)}
            >
              {produkList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama} - Rp {p.harga.toLocaleString()} (Stok: {p.stok})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="input-jumlah">Jumlah:</label>
            <input
              id="input-jumlah"
              type="number"
              min="1"
              value={jumlah}
              onChange={(e) => setJumlah(parseInt(e.target.value, 10) || 1)}
            />
          </div>

          <div className="btn-group">
            <button
              id="btn-order-sync"
              className="btn btn-sync"
              disabled={loading}
              onClick={handleOrderSync}
            >
              Order Sync (200ms)
            </button>
            <button
              id="btn-order-async"
              className="btn btn-async"
              disabled={loading}
              onClick={handleOrderAsync}
            >
              Order Async (202)
            </button>
          </div>

          {statusMessage && (
            <div className={`alert alert-${statusMessage.type}`}>
              {statusMessage.text}
            </div>
          )}

          {activeJob && (
            <div className="code-block">
              Job Status: {JSON.stringify(activeJob, null, 2)}
            </div>
          )}
        </div>
      </div>

      {/* Tabel Daftar Order */}
      <div className="card">
        <div className="card-title">
          <span>Riwayat Order</span>
          <button className="btn btn-sync" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={fetchOrder}>
            Refresh
          </button>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>ID Produk</th>
                <th>Jumlah</th>
                <th>Subtotal</th>
                <th>Diskon ML (%)</th>
                <th>Potongan Diskon</th>
                <th>Total Bayar Akhir</th>
              </tr>
            </thead>
            <tbody>
              {orderList.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: '#9ca3af' }}>
                    Belum ada order tersimpan.
                  </td>
                </tr>
              ) : (
                orderList.map((o) => (
                  <tr key={o.id}>
                    <td>#{o.id}</td>
                    <td>Produk ID {o.id_produk}</td>
                    <td>{o.jumlah} item</td>
                    <td>Rp {o.subtotal ? o.subtotal.toLocaleString() : (o.total ? o.total.toLocaleString() : '0')}</td>
                    <td style={{ color: '#fbbf24', fontWeight: 600 }}>{o.diskon_persen || 0}%</td>
                    <td style={{ color: '#f43f5e' }}>-Rp {(o.total_diskon || 0).toLocaleString()}</td>
                    <td style={{ fontWeight: 700, color: '#10b981' }}>Rp {o.total ? o.total.toLocaleString() : '0'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
