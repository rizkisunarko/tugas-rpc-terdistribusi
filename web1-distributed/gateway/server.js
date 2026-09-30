const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 8000;

const PYTHON_SERVICE_URL = 'http://127.0.0.1:5001/rpc';
const PHP_SERVICE_URL = 'http://127.0.0.1:5002/rpc';

app.use(cors());
app.use(express.json());

const jobs = {};

const mockProduk = [
    { id: 1, nama: "Kopi", harga: 15000, stok: 50 },
    { id: 2, nama: "Teh", harga: 10000, stok: 80 },
    { id: 3, nama: "Susu", harga: 12000, stok: 30 }
];
const mockOrders = [];

async function callRpc(url, method, params = {}, id = 1) {
    const payload = { jsonrpc: "2.0", method, params, id };
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return await response.json();
}

function sendRpcErrorAsHttp(res, rpcError) {
    const code = rpcError?.code;
    let status = 400;

    if (code === -32601) {
        status = 404;
    } else if (code === -32602) {
        const msg = (rpcError?.message || '').toLowerCase();
        status = (msg.includes('tidak ada') || msg.includes('tidak ditemukan')) ? 404 : 400;
    } else if (code === -32000) {
        status = 409;
    }

    return res.status(status).json(rpcError);
}

// 1. GET /api/produk
app.get('/api/produk', async (req, res) => {
    try {
        const rpcRes = await callRpc(PYTHON_SERVICE_URL, 'listProduk');
        if (rpcRes.error) return sendRpcErrorAsHttp(res, rpcRes.error);
        return res.json(rpcRes.result);
    } catch (err) {
        return res.json(mockProduk);
    }
});

// 2. GET /api/produk/:id
app.get('/api/produk/:id', async (req, res) => {
    const prodId = parseInt(req.params.id, 10);
    try {
        const rpcRes = await callRpc(PYTHON_SERVICE_URL, 'getProduk', { id: prodId });
        if (rpcRes.error) return sendRpcErrorAsHttp(res, rpcRes.error);
        return res.json(rpcRes.result);
    } catch (err) {
        const item = mockProduk.find(p => p.id === prodId);
        if (!item) return res.status(404).json({ code: -32602, message: "Produk tidak ditemukan" });
        return res.json(item);
    }
});

// 3. GET /api/produk/rekomendasi/:id (Machine Learning - Cosine Similarity)
app.get('/api/produk/rekomendasi/:id', async (req, res) => {
    try {
        const prodId = parseInt(req.params.id, 10);
        const rpcRes = await callRpc(PYTHON_SERVICE_URL, 'rekomendasiProduk', { id: prodId });
        if (rpcRes.error) return sendRpcErrorAsHttp(res, rpcRes.error);
        return res.json(rpcRes.result);
    } catch (err) {
        return res.status(500).json({ error: 'Gagal memproses ML Rekomendasi' });
    }
});

// 4. POST /api/produk/prediksi-diskon (Machine Learning - Linear Regression)
app.post('/api/produk/prediksi-diskon', async (req, res) => {
    try {
        const { jumlah } = req.body;
        const rpcRes = await callRpc(PYTHON_SERVICE_URL, 'prediksiDiskon', { jumlah: parseInt(jumlah, 10) });
        if (rpcRes.error) return sendRpcErrorAsHttp(res, rpcRes.error);
        return res.json(rpcRes.result);
    } catch (err) {
        return res.status(500).json({ error: 'Gagal memproses ML Prediksi Diskon' });
    }
});

// 5. GET /api/order
app.get('/api/order', async (req, res) => {
    try {
        const rpcRes = await callRpc(PHP_SERVICE_URL, 'listOrder');
        if (rpcRes.error) return sendRpcErrorAsHttp(res, rpcRes.error);
        return res.json(rpcRes.result);
    } catch (err) {
        return res.json(mockOrders);
    }
});

// 6. POST /api/order (Direct Order)
app.post('/api/order', async (req, res) => {
    const { id_produk, jumlah } = req.body;
    try {
        const rpcRes = await callRpc(PHP_SERVICE_URL, 'buatOrder', {
            id_produk: parseInt(id_produk, 10),
            jumlah: parseInt(jumlah, 10)
        });
        if (rpcRes.error) return sendRpcErrorAsHttp(res, rpcRes.error);
        return res.json(rpcRes.result);
    } catch (err) {
        const prod = mockProduk.find(p => p.id === parseInt(id_produk, 10));
        if (!prod) return res.status(404).json({ code: -32602, message: "Produk tidak ditemukan" });
        if (prod.stok < jumlah) return res.status(409).json({ code: -32000, message: "stok tidak cukup" });

        prod.stok -= jumlah;
        const subtotal = prod.harga * jumlah;
        const diskon_persen = jumlah >= 10 ? 7.15 : (jumlah >= 5 ? 5.0 : 0.0);
        const total_diskon = Math.round(subtotal * (diskon_persen / 100));
        const total = subtotal - total_diskon;
        const newOrder = { id: mockOrders.length + 1, id_produk: prod.id, jumlah: parseInt(jumlah, 10), subtotal, diskon_persen, total_diskon, total };
        mockOrders.push(newOrder);
        return res.json(newOrder);
    }
});

// 7. POST /api/order/sync
app.post('/api/order/sync', async (req, res) => {
    const { id_produk, jumlah } = req.body;
    try {
        const rpcRes = await callRpc(PHP_SERVICE_URL, 'buatOrderSync', {
            id_produk: parseInt(id_produk, 10),
            jumlah: parseInt(jumlah, 10)
        });
        if (rpcRes.error) return sendRpcErrorAsHttp(res, rpcRes.error);
        return res.json(rpcRes.result);
    } catch (err) {
        await new Promise(r => setTimeout(r, 200));
        const prod = mockProduk.find(p => p.id === parseInt(id_produk, 10));
        if (!prod) return res.status(404).json({ code: -32602, message: "Produk tidak ditemukan" });
        if (prod.stok < jumlah) return res.status(409).json({ code: -32000, message: "stok tidak cukup" });

        prod.stok -= jumlah;
        const subtotal = prod.harga * jumlah;
        const diskon_persen = jumlah >= 10 ? 7.15 : (jumlah >= 5 ? 5.0 : 0.0);
        const total_diskon = Math.round(subtotal * (diskon_persen / 100));
        const total = subtotal - total_diskon;
        const newOrder = { id: mockOrders.length + 1, id_produk: prod.id, jumlah: parseInt(jumlah, 10), subtotal, diskon_persen, total_diskon, total };
        mockOrders.push(newOrder);
        return res.json(newOrder);
    }
});

// 8. POST /api/order/async
app.post('/api/order/async', (req, res) => {
    const { id_produk, jumlah } = req.body;
    const jobId = 'job_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

    jobs[jobId] = { jobId, status: 'pending', createdAt: new Date().toISOString() };

    res.status(202).json({ jobId, status: 'pending', message: 'Order sedang diproses di latar belakang' });

    (async () => {
        try {
            const rpcRes = await callRpc(PHP_SERVICE_URL, 'buatOrderSync', {
                id_produk: parseInt(id_produk, 10),
                jumlah: parseInt(jumlah, 10)
            });

            if (rpcRes.error) {
                const httpCode = rpcRes.error?.code === -32000 ? 409 : (rpcRes.error?.code === -32602 ? 404 : 400);
                jobs[jobId] = { jobId, status: 'error', httpStatus: httpCode, error: rpcRes.error };
            } else {
                jobs[jobId] = { jobId, status: 'done', result: rpcRes.result };
            }
        } catch (err) {
            await new Promise(r => setTimeout(r, 200));
            const prod = mockProduk.find(p => p.id === parseInt(id_produk, 10));
            if (!prod) {
                jobs[jobId] = { jobId, status: 'error', httpStatus: 404, error: { code: -32602, message: "Produk tidak ditemukan" } };
            } else if (prod.stok < jumlah) {
                jobs[jobId] = { jobId, status: 'error', httpStatus: 409, error: { code: -32000, message: "stok tidak cukup" } };
            } else {
                prod.stok -= jumlah;
                const subtotal = prod.harga * jumlah;
                const diskon_persen = jumlah >= 10 ? 7.15 : (jumlah >= 5 ? 5.0 : 0.0);
                const total_diskon = Math.round(subtotal * (diskon_persen / 100));
                const total = subtotal - total_diskon;
                const newOrder = { id: mockOrders.length + 1, id_produk: prod.id, jumlah: parseInt(jumlah, 10), subtotal, diskon_persen, total_diskon, total };
                mockOrders.push(newOrder);
                jobs[jobId] = { jobId, status: 'done', result: newOrder };
            }
        }
    })();
});

// 9. GET /api/order/status/:jobId
app.get('/api/order/status/:jobId', (req, res) => {
    const job = jobs[req.params.jobId];
    if (!job) return res.status(404).json({ error: 'Job ID tidak ditemukan' });
    return res.json(job);
});

app.listen(PORT, () => {
    console.log(`Node.js Express Gateway berjalan di port ${PORT}`);
});
