from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.linear_model import LinearRegression

app = FastAPI(title="Service Produk (Python JSON-RPC + ML)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory database produk
produk_db = [
    {"id": 1, "nama": "Kopi", "harga": 15000, "stok": 50, "kategori": "minuman_hangat", "kategori_vec": [1, 0, 15000]},
    {"id": 2, "nama": "Teh", "harga": 10000, "stok": 80, "kategori": "minuman_hangat", "kategori_vec": [1, 0, 10000]},
    {"id": 3, "nama": "Susu", "harga": 12000, "stok": 30, "kategori": "minuman_dingin", "kategori_vec": [0, 1, 12000]}
]

# Machine Learning Model 1: Training Model Linear Regression untuk Prediksi Diskon Otomatis
X_train = np.array([[1], [3], [5], [10], [20], [50]])
y_train = np.array([0, 2, 5, 10, 15, 25])
ml_diskon_model = LinearRegression()
ml_diskon_model.fit(X_train, y_train)

def calculate_ml_discount(jumlah):
    pred_diskon = ml_diskon_model.predict(np.array([[jumlah]]))[0]
    return max(0, min(30, round(float(pred_diskon), 2)))

def make_jsonrpc_response(result=None, error=None, req_id=None):
    response = {"jsonrpc": "2.0", "id": req_id}
    if error:
        response["error"] = error
    else:
        response["result"] = result
    return JSONResponse(content=response)

@app.post("/rpc")
async def rpc_handler(request: Request):
    try:
        body = await request.json()
    except Exception:
        return make_jsonrpc_response(
            error={"code": -32700, "message": "Parse error (Invalid JSON)"},
            req_id=None
        )

    jsonrpc = body.get("jsonrpc")
    method = body.get("method")
    params = body.get("params", {})
    req_id = body.get("id")

    if jsonrpc != "2.0" or not method:
        return make_jsonrpc_response(
            error={"code": -32600, "message": "Invalid Request format"},
            req_id=req_id
        )

    # Method 1: listProduk
    if method == "listProduk":
        return make_jsonrpc_response(result=produk_db, req_id=req_id)

    # Method 2: getProduk
    elif method == "getProduk":
        if not isinstance(params, dict) or "id" not in params:
            return make_jsonrpc_response(
                error={"code": -32602, "message": "params salah/tidak ditemukan (butuh 'id')"},
                req_id=req_id
            )
        prod_id = int(params["id"])
        produk = next((p for p in produk_db if p["id"] == prod_id), None)
        if not produk:
            return make_jsonrpc_response(
                error={"code": -32602, "message": "params salah/tidak ditemukan (Produk ID tidak ada)"},
                req_id=req_id
            )
        return make_jsonrpc_response(result=produk, req_id=req_id)

    # Method 3: kurangiStok (Menghitung diskon ML Linear Regression otomatis)
    elif method == "kurangiStok":
        if not isinstance(params, dict) or "id" not in params or "jumlah" not in params:
            return make_jsonrpc_response(
                error={"code": -32602, "message": "params salah/tidak ditemukan"},
                req_id=req_id
            )
        prod_id = int(params["id"])
        jumlah = int(params["jumlah"])
        produk = next((p for p in produk_db if p["id"] == prod_id), None)
        if not produk:
            return make_jsonrpc_response(
                error={"code": -32602, "message": "params salah/tidak ditemukan (Produk ID tidak ada)"},
                req_id=req_id
            )
        if produk["stok"] < jumlah:
            return make_jsonrpc_response(
                error={"code": -32000, "message": "stok tidak cukup"},
                req_id=req_id
            )
        produk["stok"] -= jumlah
        diskon_persen = calculate_ml_discount(jumlah)
        
        result_payload = dict(produk)
        result_payload["diskon_persen"] = diskon_persen
        return make_jsonrpc_response(result=result_payload, req_id=req_id)

    # Method 4 (ML): rekomendasiProduk (Cosine Similarity)
    elif method == "rekomendasiProduk":
        if not isinstance(params, dict) or "id" not in params:
            return make_jsonrpc_response(
                error={"code": -32602, "message": "params 'id' dibutuhkan"},
                req_id=req_id
            )
        prod_id = int(params["id"])
        target_prod = next((p for p in produk_db if p["id"] == prod_id), None)
        if not target_prod:
            return make_jsonrpc_response(
                error={"code": -32602, "message": "Produk tidak ditemukan"},
                req_id=req_id
            )

        features = np.array([p["kategori_vec"] for p in produk_db])
        target_vec = np.array([target_prod["kategori_vec"]])
        sim_scores = cosine_similarity(target_vec, features)[0]

        rekomendasi = []
        for idx, score in enumerate(sim_scores):
            if produk_db[idx]["id"] != prod_id:
                rekomendasi.append({
                    "id": produk_db[idx]["id"],
                    "nama": produk_db[idx]["nama"],
                    "harga": produk_db[idx]["harga"],
                    "similarity_score": round(float(score), 4)
                })

        rekomendasi.sort(key=lambda x: x["similarity_score"], reverse=True)
        return make_jsonrpc_response(result={
            "produk_asal": target_prod["nama"],
            "metode_ml": "Cosine Similarity (Content-Based Filtering)",
            "rekomendasi": rekomendasi
        }, req_id=req_id)

    # Method 5 (ML): prediksiDiskon (Linear Regression)
    elif method == "prediksiDiskon":
        jumlah = int(params.get("jumlah", 1))
        diskon_persen = calculate_ml_discount(jumlah)

        return make_jsonrpc_response(result={
            "jumlah_beli": jumlah,
            "metode_ml": "Linear Regression (Estimasi Diskon Dinamis)",
            "diskon_persen": diskon_persen
        }, req_id=req_id)

    else:
        return make_jsonrpc_response(
            error={"code": -32601, "message": "method tidak ada"},
            req_id=req_id
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
