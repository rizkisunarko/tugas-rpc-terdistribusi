# Toko Online Mini — Tugas Mata Kuliah Sistem Terdistribusi

Proyek ini dibuat untuk memenuhi tugas **Mata Kuliah Sistem Terdistribusi** yang menguji dan membandingkan kinerja serta arsitektur antara **Arsitektur Web 1 (Multi-Platform Kernel berbasis JSON-RPC 2.0 + Machine Learning)** dan **Arsitektur Web 2 (Monolit Django + Machine Learning)**.

---

## 👥 Anggota Kelompok

| No | Nama Mahasiswa | NIM | Peran / Pembagian Tugas |
| :-: | :--- | :--- | :--- |
| 1 | [Rizki Pratama Sunarko] | [240411100181] | Gateway Node.js & React UI |
| 2 | [Mohammad Andri Firmansyah] | [240411100139] | Service Produk Python + Machine Learning |
| 3 | [Abyan Naufal Yunianto] | [240411100178] | Service Order PHP Polos |
| 4 | [Dien Latif Asyari] | [240411100038] | Web 2 Django Monolith & Uji JMeter |

---

## 🤖 Metode Machine Learning (ML) yang Digunakan

Proyek ini mengintegrasikan 2 fitur berbasis **Machine Learning (ML)** pada kedua arsitektur web:

### 1. **Linear Regression (Metode Regresi — Supervised Learning)**
- **Kegunaan:** Fitur **Prediksi Diskon Dinamis** (`POST /api/produk/prediksi-diskon`).
- **Penjelasan:** Memprediksi nilai kontinu berupa persentase diskon dinamis ($y$) berdasarkan variabel input kuantitas barang yang dibeli ($x$). Model ini dilatih menggunakan `sklearn.linear_model.LinearRegression`.

### 2. **Cosine Similarity (Similarity Metric — Content-Based Recommendation)**
- **Kegunaan:** Fitur **Sistem Rekomendasi Produk Serupa** (`GET /api/produk/rekomendasi/:id`).
- **Penjelasan:** Menghitung sudut kemiripan (*distance metric*) antar-vektor atribut fitur produk (kategori & rentang harga) menggunakan `sklearn.metrics.pairwise.cosine_similarity` untuk menyajikan rekomendasi produk yang paling relevan.

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
│   ├── service-produk/              # Service Produk (Python + FastAPI + ML - Port 5001)
│   │   ├── main.py                  # Handler JSON-RPC 2.0 (/rpc) & Model ML (Linear Regression & Cosine Similarity)
│   │   └── requirements.txt
│   └── service-order/               # Service Order (PHP Polos - Port 5002)
│       └── index.php                # Handler JSON-RPC 2.0 (/rpc) & Persistensi JSON
│
├── web2-monolith/                   # ARSITEKTUR WEB 2 (Monolit Django + ML - Port 8001)
│   ├── manage.py
│   ├── templates/
│   │   └── index.html               # UI Django HTML Template
│   └── monolith/
│       ├── settings.py              # Konfigurasi Django
│       ├── urls.py                  # Routing API & View
│       └── views.py                 # Logika Monolit Produk, Order & Model ML
│
├── jmeter/                          # UJI PERFORMA JMETER
│   └── test.jmx                     # Skrip Pengujian Performa JMeter
└── README.md                        # Dokumentasi Utama
```

---

## 💻 Prasyarat Sistem

Pastikan perangkat Anda sudah terinstall:
- **Node.js**: v18.x atau versi lebih baru
- **Python**: v3.10 atau versi lebih baru (`scikit-learn`, `numpy`, `fastapi`, `uvicorn`, `django`)
- **PHP**: v8.0 atau versi lebih baru
- **Apache JMeter**: v5.x (untuk uji performa)

---

## 🚀 Cara Menjalankan Aplikasi

### 1. Menjalankan Web 1 (Multi-Platform Distributed)

Buka 4 terminal PowerShell/Command Prompt secara terpisah:

#### Terminal 1: Service Produk (Python FastAPI + ML — Port 5001)
```powershell
cd "web1-distributed\service-produk"
python -m pip install -r requirements.txt scikit-learn numpy
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

### 2. Menjalankan Web 2 (Monolit Django + ML — Port 8001)

Buka 1 terminal terpisah:

```powershell
cd "web2-monolith"
python -m pip install django scikit-learn numpy
python manage.py runserver 8001
```
> **Akses Frontend Web 2:** Buka browser di [http://localhost:8001](http://localhost:8001)

---

## 🧪 Contoh Pengujian API (cURL / PowerShell)

### 1. GET Daftar Produk
```powershell
curl.exe -s http://localhost:8000/api/produk
```

### 2. GET Rekomendasi Produk Serupa (Machine Learning - Cosine Similarity)
```powershell
curl.exe -s http://localhost:8000/api/produk/rekomendasi/1
```
**Respon JSON:**
```json
{
  "produk_asal": "Kopi",
  "metode_ml": "Cosine Similarity (Content-Based Filtering)",
  "rekomendasi": [
    {"id": 2, "nama": "Teh", "harga": 10000, "similarity_score": 1.0},
    {"id": 3, "nama": "Susu", "harga": 12000, "similarity_score": 1.0}
  ]
}
```

### 3. POST Prediksi Diskon Dinamis (Machine Learning - Linear Regression)
```powershell
curl.exe -s -X POST http://localhost:8000/api/produk/prediksi-diskon -H "Content-Type: application/json" -d "{\"jumlah\": 10}"
```
**Respon JSON:**
```json
{
  "jumlah_beli": 10,
  "metode_ml": "Linear Regression (Estimasi Diskon Dinamis)",
  "diskon_persen": 7.15
}
```

### 4. POST Order Synchronous (`/api/order/sync`)
```powershell
curl.exe -s -X POST http://localhost:8000/api/order/sync -H "Content-Type: application/json" -d "{\"id_produk\": 1, \"jumlah\": 2}"
```

### 5. POST Order Asynchronous (`/api/order/async`)
```powershell
curl.exe -s -X POST http://localhost:8000/api/order/async -H "Content-Type: application/json" -d "{\"id_produk\": 2, \"jumlah\": 3}"
```

### 6. GET Status Async Job (`/api/order/status/:jobId`)
```powershell
curl.exe -s http://localhost:8000/api/order/status/job_1790602767645_72
```

---

## 📊 Pengujian Performa Apache JMeter

File test plan JMeter tersimpan di [`jmeter/test.jmx`](file:///d:/Backup%20Data%20C/Downloads/Documents/Semester%205/Sistem%20Terdistribusi/tugas-rpc-terdistribusi/jmeter/test.jmx).

### Perintah Menjalankan JMeter CLI:
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

### Tabel Kode Error:
- `-32601`: Method tidak ditemukan / tidak ada.
- `-32602`: Params salah / Produk ID tidak ditemukan.
- `-32000`: Stok produk tidak cukup.