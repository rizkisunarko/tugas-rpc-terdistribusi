import json
import time
import threading
import random
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.linear_model import LinearRegression
from django.shortcuts import render
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt

produk_db = [
    {"id": 1, "nama": "Kopi", "harga": 15000, "stok": 50, "kategori_vec": [1, 0, 15000]},
    {"id": 2, "nama": "Teh", "harga": 10000, "stok": 80, "kategori_vec": [1, 0, 10000]},
    {"id": 3, "nama": "Susu", "harga": 12000, "stok": 30, "kategori_vec": [0, 1, 12000]}
]
orders_db = []
jobs_db = {}

# Machine Learning Model Linear Regression untuk Prediksi Diskon
X_train = np.array([[1], [3], [5], [10], [20], [50]])
y_train = np.array([0, 2, 5, 10, 15, 25])
ml_diskon_model = LinearRegression()
ml_diskon_model.fit(X_train, y_train)

def calculate_ml_discount(jumlah):
    pred_diskon = ml_diskon_model.predict(np.array([[jumlah]]))[0]
    return max(0, min(30, round(float(pred_diskon), 2)))

def index_view(request):
    return render(request, 'index.html', {
        'produk_list': produk_db,
        'order_list': orders_db
    })

def get_all_produk(request):
    return JsonResponse(produk_db, safe=False)

def get_produk_by_id(request, produk_id):
    prod = next((p for p in produk_db if p["id"] == int(produk_id)), None)
    if not prod:
        return JsonResponse({"code": -32602, "message": "Produk tidak ditemukan"}, status=404)
    return JsonResponse(prod)

def get_rekomendasi_produk(request, produk_id):
    target_prod = next((p for p in produk_db if p["id"] == int(produk_id)), None)
    if not target_prod:
        return JsonResponse({"code": -32602, "message": "Produk tidak ditemukan"}, status=404)

    features = np.array([p["kategori_vec"] for p in produk_db])
    target_vec = np.array([target_prod["kategori_vec"]])
    sim_scores = cosine_similarity(target_vec, features)[0]

    rekomendasi = []
    for idx, score in enumerate(sim_scores):
        if produk_db[idx]["id"] != int(produk_id):
            rekomendasi.append({
                "id": produk_db[idx]["id"],
                "nama": produk_db[idx]["nama"],
                "harga": produk_db[idx]["harga"],
                "similarity_score": round(float(score), 4)
            })

    rekomendasi.sort(key=lambda x: x["similarity_score"], reverse=True)
    return JsonResponse({
        "produk_asal": target_prod["nama"],
        "metode_ml": "Cosine Similarity (Content-Based Filtering)",
        "rekomendasi": rekomendasi
    })

@csrf_exempt
def predict_diskon(request):
    if request.method != 'POST':
        return HttpResponseBadRequest("Method not allowed")
    try:
        body = json.loads(request.body)
        jumlah = int(body.get("jumlah", 1))
    except Exception:
        jumlah = 1

    diskon_persen = calculate_ml_discount(jumlah)
    return JsonResponse({
        "jumlah_beli": jumlah,
        "metode_ml": "Linear Regression (Estimasi Diskon Dinamis)",
        "diskon_persen": diskon_persen
    })

def get_all_orders(request):
    return JsonResponse(orders_db, safe=False)

def _process_order(id_produk, jumlah):
    prod = next((p for p in produk_db if p["id"] == int(id_produk)), None)
    if not prod:
        return None, {"code": -32602, "message": "Produk tidak ditemukan"}, 404
    if prod["stok"] < int(jumlah):
        return None, {"code": -32000, "message": "stok tidak cukup"}, 409

    prod["stok"] -= int(jumlah)
    subtotal = prod["harga"] * int(jumlah)
    diskon_persen = calculate_ml_discount(jumlah)
    total_diskon = round(subtotal * (diskon_persen / 100.0))
    total = subtotal - total_diskon

    new_order = {
        "id": len(orders_db) + 1,
        "id_produk": prod["id"],
        "jumlah": int(jumlah),
        "subtotal": subtotal,
        "diskon_persen": diskon_persen,
        "total_diskon": total_diskon,
        "total": total
    }
    orders_db.append(new_order)
    return new_order, None, 200

@csrf_exempt
def create_order(request):
    if request.method != 'POST':
        return HttpResponseBadRequest("Method not allowed")
    try:
        body = json.loads(request.body)
        id_produk, jumlah = body.get("id_produk"), body.get("jumlah", 1)
    except Exception:
        return JsonResponse({"code": -32700, "message": "Parse error"}, status=400)

    order, error, status_code = _process_order(id_produk, jumlah)
    if error:
        return JsonResponse(error, status=status_code)
    return JsonResponse(order)

@csrf_exempt
def create_order_sync(request):
    if request.method != 'POST':
        return HttpResponseBadRequest("Method not allowed")
    try:
        body = json.loads(request.body)
        id_produk, jumlah = body.get("id_produk"), body.get("jumlah", 1)
    except Exception:
        return JsonResponse({"code": -32700, "message": "Parse error"}, status=400)

    time.sleep(0.2)
    order, error, status_code = _process_order(id_produk, jumlah)
    if error:
        return JsonResponse(error, status=status_code)
    return JsonResponse(order)

@csrf_exempt
def create_order_async(request):
    if request.method != 'POST':
        return HttpResponseBadRequest("Method not allowed")
    try:
        body = json.loads(request.body)
        id_produk, jumlah = body.get("id_produk"), body.get("jumlah", 1)
    except Exception:
        return JsonResponse({"code": -32700, "message": "Parse error"}, status=400)

    job_id = f"job_{int(time.time() * 1000)}_{random.randint(100, 999)}"
    jobs_db[job_id] = {"jobId": job_id, "status": "pending"}

    def background_worker():
        time.sleep(0.2)
        order, error, status_code = _process_order(id_produk, jumlah)
        if error:
            jobs_db[job_id] = {"jobId": job_id, "status": "error", "httpStatus": status_code, "error": error}
        else:
            jobs_db[job_id] = {"jobId": job_id, "status": "done", "result": order}

    thread = threading.Thread(target=background_worker)
    thread.daemon = True
    thread.start()

    return JsonResponse({
        "jobId": job_id,
        "status": "pending",
        "message": "Order sedang diproses di latar belakang"
    }, status=202)

def get_job_status(request, job_id):
    job = jobs_db.get(job_id)
    if not job:
        return JsonResponse({"error": "Job ID tidak ditemukan"}, status=404)
    return JsonResponse(job)
