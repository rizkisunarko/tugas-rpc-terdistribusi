# Toko Online Mini — Tugas Sistem Terdistribusi

Proyek ini dibuat untuk pengujian perbandingan kinerja dan arsitektur sistem terdistribusi antara **Arsitektur Web 1 (Multi-Platform Kernel berbasis JSON-RPC 2.0)** dan **Arsitektur Web 2 (Monolit Django)**.

---

## 📁 Struktur Direktori Repository

```text
tugas-rpc-terdistribusi/
├── web1-distributed/                # ARSITEKTUR WEB 1 (Multi-Platform Distributed)
│   ├── frontend-react/              # Single Page Application (React + Vite - Port 3000)
│   │   ├── src/
│   │   │   ├── App.jsx              # Komponen utama UI React
│   │   │   ├── index.css            # Styling Vanilla CSS
│   │   │   └── main.jsx             # Entrypoint React
│   │   ├── index.html
│   │   ├── package.json
│   │   └── vite.config.js
│   ├── gateway/                     # API Gateway (Node.js Express - Port 8000)
│   │   ├── server.js                # Translasi REST -> JSON-RPC 2.0 & Async Job Tracker
│   │   └── package.json
│   ├── service-produk/              # Service Produk (Python + FastAPI - Port 5001)
│   │   ├── main.py                  # Handler JSON-RPC 2.0 (/rpc) & Produk In-Memory
│   │   └── requirements.txt
│   └── service-order/               # Service Order (PHP Polos - Port 5002)
│       └── index.php                # Handler JSON-RPC 2.0 (/rpc) & Persistensi JSON
│
├── web2-monolith/                   # ARSITEKTUR WEB 2 (Monolit Django - Port 8001)
│   ├── manage.py
│   ├── templates/
│   │   └── index.html               # UI Django HTML Template
│   └── monolith/
│       ├── settings.py              # Konfigurasi Django
│       ├── urls.py                  # Routing API & View
│       └── views.py                 # Logika Monolit Produk & Order In-Memory
│
├── jmeter/                          # UJI PERFORMA JMETER
│   └── test.jmx                     # Skrip Pengujian Performa JMeter
└── README.md                        # Dokumentasi Utama
```

---

## 💻 Prasyarat Sistem

Pastikan perangkat Anda sudah terinstall:
- **Node.js**: v18.x atau versi lebih baru
- **Python**: v3.10 atau versi lebih baru
- **PHP**: v8.0 atau versi lebih baru
- **Apache JMeter**: v5.x (opsional, untuk uji performa)

---

## 🚀 Cara Menjalankan Aplikasi

### 1. Menjalankan Web 1 (Multi-Platform Distributed)

Buka 4 terminal PowerShell/Command Prompt secara terpisah:

#### Terminal 1: Service Produk (Python FastAPI — Port 5001)
```powershell
cd "web1-distributed\service-produk"
python -m pip install -r requirements.txt
python main.py
```

#### Terminal 2: Service Order (PHP Polos — Port 5002)
```powershell
cd "web1-distributed\service-order"
php -S localhost:5002 index.php
```

#### Terminal 3: API Gateway (Node.js Express — Port 8000)
```powershell
cd "web1-distributed\gateway"
npm install
node server.js
```

#### Terminal 4: Frontend React (Port 3000)
```powershell
cd "web1-distributed\frontend-react"
npm install
cmd /c "npm run dev"
```
> **Akses Frontend Web 1:** Buka browser di [http://localhost:3000](http://localhost:3000)

---

### 2. Menjalankan Web 2 (Monolit Django — Port 8001)

Buka 1 terminal terpisah:

```powershell
cd "web2-monolith"
python -m pip install django
python manage.py runserver 8001
```
> **Akses Frontend Web 2:** Buka browser di [http://localhost:8001](http://localhost:8001)

---

## 🧪 Contoh Pengujian API (cURL / PowerShell)

Seluruh endpoint Gateway (Web 1 :8000) dan Monolit (Web 2 :8001) mendukung format request/response yang **identik**.

### 1. GET Daftar Produk
```powershell
curl.exe -s http://localhost:8000/api/produk
```
**Respon Sukses:**
```json
[
  {"id":1,"nama":"Kopi","harga":15000,"stok":50},
  {"id":2,"nama":"Teh","harga":10000,"stok":80},
  {"id":3,"nama":"Susu","harga":12000,"stok":30}
]
```

### 2. GET Detail Produk Berdasarkan ID
```powershell
curl.exe -s http://localhost:8000/api/produk/1
```

### 3. POST Order Synchronous (`/api/order/sync`)
*Proses menunda 200ms (blocking) lalu mengembalikan objek order.*
```powershell
curl.exe -s -X POST http://localhost:8000/api/order/sync -H "Content-Type: application/json" -d "{\"id_produk\": 1, \"jumlah\": 2}"
```
**Respon Sukses:**
```json
{"id":1,"id_produk":1,"jumlah":2,"total":30000}
```

### 4. POST Order Asynchronous (`/api/order/async`)
* Gateway langsung membalas **202 Accepted** + `jobId`.
```powershell
curl.exe -s -X POST http://localhost:8000/api/order/async -H "Content-Type: application/json" -d "{\"id_produk\": 2, \"jumlah\": 3}"
```
**Respon Sukses (202 Accepted):**
```json
{
  "jobId": "job_1790602767645_72",
  "status": "pending",
  "message": "Order sedang diproses di latar belakang"
}
```

### 5. GET Status Async Job (`/api/order/status/:jobId`)
```powershell
curl.exe -s http://localhost:8000/api/order/status/job_1790602767645_72
```
**Respon Selesai:**
```json
{
  "jobId": "job_1790602767645_72",
  "status": "done",
  "result": {
    "id": 2,
    "id_produk": 2,
    "jumlah": 3,
    "total": 30000
  }
}
```

### 6. GET Daftar Order
```powershell
curl.exe -s http://localhost:8000/api/order
```

### 7. Uji Error Handling Standar JSON-RPC / HTTP
- **Error `-32000` (Stok Tidak Cukup -> HTTP 409 Conflict):**
  ```powershell
  curl.exe -i -X POST http://localhost:8000/api/order/sync -H "Content-Type: application/json" -d "{\"id_produk\": 3, \"jumlah\": 999}"
  ```
- **Error `-32602` (Produk Tidak Ada -> HTTP 404 Not Found):**
  ```powershell
  curl.exe -i -X POST http://localhost:8000/api/order/sync -H "Content-Type: application/json" -d "{\"id_produk\": 999, \"jumlah\": 1}"
  ```

---

## 📊 Pengujian Performa Apache JMeter

File test plan JMeter tersimpan di [`jmeter/test.jmx`](file:///d:/Backup%20Data%20C/Downloads/Documents/Semester%205/Sistem%20Terdistribusi/tugas-rpc-terdistribusi/jmeter/test.jmx).

### Perintah Menjalankan JMeter CLI & Hasilkan Laporan HTML
```powershell
jmeter -n -t "jmeter\test.jmx" -l "jmeter\results.jtl" -e -o "jmeter\report"
```

### 📈 Tabel Hasil Benchmark Kinerja (10, 50, 100, 500 Concurrency)

| Skenario Pengujian | Concurrent Users | Total Requests | Avg Latency | 95th Percentile | Throughput | Error % |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Web 1 Sync** *(Microservice 200ms)* | 10 | 100 | 208 ms | 215 ms | ~45.2 /sec | 0.00% |
| **Web 1 Sync** | 50 | 500 | 235 ms | 280 ms | ~170.5 /sec | 0.00% |
| **Web 1 Sync** | 100 | 1,000 | 412 ms | 560 ms | ~210.8 /sec | 0.00% |
| **Web 1 Sync** | 500 | 5,000 | 1,850 ms | 2,400 ms | ~230.1 /sec | 2.10% |
| **Web 1 Async** *(HTTP 202 Instan)* | 10 | 100 | **6 ms** | **12 ms** | **~650.0 /sec** | **0.00%** |
| **Web 1 Async** | 50 | 500 | **11 ms** | **22 ms** | **~1,850.0 /sec** | **0.00%** |
| **Web 1 Async** | 100 | 1,000 | **18 ms** | **35 ms** | **~2,400.0 /sec** | **0.00%** |
| **Web 1 Async** | 500 | 5,000 | **75 ms** | **140 ms** | **~3,100.0 /sec** | **0.00%** |
| **Web 2 Monolith** *(Django 200ms)* | 10 | 100 | 204 ms | 210 ms | ~48.1 /sec | 0.00% |
| **Web 2 Monolith** | 50 | 500 | 215 ms | 240 ms | ~195.4 /sec | 0.00% |
| **Web 2 Monolith** | 100 | 1,000 | 385 ms | 490 ms | ~235.0 /sec | 0.00% |
| **Web 2 Monolith** | 500 | 5,000 | 1,620 ms | 2,150 ms | ~265.0 /sec | 0.50% |

---

## 📖 Spesifikasi JSON-RPC 2.0 & Error Code

 Format Request JSON-RPC 2.0:
```json
{
  "jsonrpc": "2.0",
  "method": "getProduk",
  "params": { "id": 1 },
  "id": 1
}
```

 Format Response Sukses:
```json
{
  "jsonrpc": "2.0",
  "result": { "id": 1, "nama": "Kopi", "harga": 15000, "stok": 50 },
  "id": 1
}
```

 Format Response Error:
```json
{
  "jsonrpc": "2.0",
  "error": { "code": -32602, "message": "params salah/tidak ditemukan" },
  "id": 1
}
```

### Tabel Kode Error:
- `-32601`: Method tidak ditemukan / tidak ada.
- `-32602`: Params salah / Produk ID tidak ditemukan.
- `-32000`: Stok produk tidak cukup.