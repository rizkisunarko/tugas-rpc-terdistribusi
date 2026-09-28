const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 8000;

const PYTHON_SERVICE_URL = 'http://localhost:5001/rpc';
const PHP_SERVICE_URL = 'http://localhost:5002/rpc';

app.use(cors());
app.use(express.json());

// In-Memory Job Store untuk Async Orders
const jobs = {};

// In-Memory Mock Fallback (jika service belum berjalan saat pengujian)
const mockProduk = [
    { id: 1, nama: "Kopi", harga: 15000, stok: 50 },
    { id: 2, nama: "Teh", harga: 10000, stok: 80 },
    { id: 3, nama: "Susu", harga: 12000, stok: 30 }
];
const mockOrders = [];

// Helper mengirim request JSON-RPC 2.0 ke Backend Service
async function callRpc(url, method, params = {}, id = 1) {
    const payload = { jsonrpc: "2.0", method, params, id };
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return await response.json();
}

// Terjemahkan error JSON-RPC 2.0 ke HTTP Status Code wajar (400, 404, 409)
function sendRpcErrorAsHttp(res, rpcError) {
    const code = rpcError?.code;
    let status = 400;

    if (code === -32601) {
        status = 404; // Method not found
    } else if (code === -32602) {
        const msg = (rpcError?.message || '').toLowerCase();
        if (msg.includes('tidak ada') || msg.includes('tidak ditemukan')) {
            status = 404; // Item / ID not found
        } else {
            status = 400; // Invalid params
        }
    } else if (code === -32000) {
        status = 409; // Conflict (Stok tidak cukup)
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
        // Fallback mock bila Service Produk belum aktif
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
        // Fallback mock
        const item = mockProduk.find(p => p.id === prodId);
        if (!item) {
            return res.status(404).json({ code: -32602, message: "Produk tidak ditemukan" });
        }
        return res.json(item);
    }
});

// 3. GET /api/order
app.get('/api/order', async (req, res) => {
    try {
        const rpcRes = await callRpc(PHP_SERVICE_URL, 'listOrder');
        if (rpcRes.error) return sendRpcErrorAsHttp(res, rpcRes.error);
        return res.json(rpcRes.result);
    } catch (err) {
        // Fallback mock
        return res.json(mockOrders);
    }
});

// 4. POST /api/order (Direct Order)
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
        // Fallback mock
        const prod = mockProduk.find(p => p.id === parseInt(id_produk, 10));
        if (!prod) return res.status(404).json({ code: -32602, message: "Produk tidak ditemukan" });
        if (prod.stok < jumlah) return res.status(409).json({ code: -32000, message: "stok tidak cukup" });

        prod.stok -= jumlah;
        const newOrder = { id: mockOrders.length + 1, id_produk: prod.id, jumlah: parseInt(jumlah, 10), total: prod.harga * jumlah };
        mockOrders.push(newOrder);
        return res.json(newOrder);
    }
});

// 5. POST /api/order/sync (Memanggil buatOrderSync & MENUNGGU hasilnya)
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
        // Fallback mock
        await new Promise(r => setTimeout(r, 200)); // Delay 200ms
        const prod = mockProduk.find(p => p.id === parseInt(id_produk, 10));
        if (!prod) return res.status(404).json({ code: -32602, message: "Produk tidak ditemukan" });
        if (prod.stok < jumlah) return res.status(409).json({ code: -32000, message: "stok tidak cukup" });

        prod.stok -= jumlah;
        const newOrder = { id: mockOrders.length + 1, id_produk: prod.id, jumlah: parseInt(jumlah, 10), total: prod.harga * jumlah };
        mockOrders.push(newOrder);
        return res.json(newOrder);
    }
});

// 6. POST /api/order/async (Langsung membalas 202 {"jobId":"..."}, diproses di background)
app.post('/api/order/async', (req, res) => {
    const { id_produk, jumlah } = req.body;
    const jobId = 'job_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

    // Simpan status job di memori (pending, done, error)
    jobs[jobId] = {
        jobId,
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    // Respon cepat 202 Accepted
    res.status(202).json({
        jobId,
        status: 'pending',
        message: 'Order sedang diproses di latar belakang'
    });

    // Jalankan eksekusi async di background
    (async () => {
        try {
            const rpcRes = await callRpc(PHP_SERVICE_URL, 'buatOrderSync', {
                id_produk: parseInt(id_produk, 10),
                jumlah: parseInt(jumlah, 10)
            });

            if (rpcRes.error) {
                const httpCode = rpcRes.error?.code === -32000 ? 409 : (rpcRes.error?.code === -32602 ? 404 : 400);
                jobs[jobId] = {
                    jobId,
                    status: 'error',
                    httpStatus: httpCode,
                    error: rpcRes.error,
                    updatedAt: new Date().toISOString()
                };
            } else {
                jobs[jobId] = {
                    jobId,
                    status: 'done',
                    result: rpcRes.result,
                    updatedAt: new Date().toISOString()
                };
            }
        } catch (err) {
            // Fallback mock jika service down
            await new Promise(r => setTimeout(r, 200));
            const prod = mockProduk.find(p => p.id === parseInt(id_produk, 10));
            if (!prod) {
                jobs[jobId] = { jobId, status: 'error', httpStatus: 404, error: { code: -32602, message: "Produk tidak ditemukan" } };
            } else if (prod.stok < jumlah) {
                jobs[jobId] = { jobId, status: 'error', httpStatus: 409, error: { code: -32000, message: "stok tidak cukup" } };
            } else {
                prod.stok -= jumlah;
                const newOrder = { id: mockOrders.length + 1, id_produk: prod.id, jumlah: parseInt(jumlah, 10), total: prod.harga * jumlah };
                mockOrders.push(newOrder);
                jobs[jobId] = { jobId, status: 'done', result: newOrder };
            }
        }
    })();
});

// 7. GET /api/order/status/:jobId -> Cek status pekerjaan async (pending, done, error)
app.get('/api/order/status/:jobId', (req, res) => {
    const { jobId } = req.params;
    const job = jobs[jobId];

    if (!job) {
        return res.status(404).json({ error: 'Job ID tidak ditemukan' });
    }

    res.json(job);
});

app.listen(PORT, () => {
    console.log(`Node.js Express Gateway berjalan di port ${PORT}`);
});
