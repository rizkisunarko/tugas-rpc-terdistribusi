import json
import time
import threading
import random
from django.shortcuts import render
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseNotFound
from django.views.decorators.csrf import csrf_exempt

# In-memory database (Array / List / Dict)
produk_db = [
    {"id": 1, "nama": "Kopi", "harga": 15000, "stok": 50},
    {"id": 2, "nama": "Teh", "harga": 10000, "stok": 80},
    {"id": 3, "nama": "Susu", "harga": 12000, "stok": 30}
]
orders_db = []
jobs_db = {}

# 1. Page View (Django Template UI Web 2 Monolit)
def index_view(request):
    return render(request, 'index.html', {
        'produk_list': produk_db,
        'order_list': orders_db
    })

# 2. GET /api/produk
def get_all_produk(request):
    return JsonResponse(produk_db, safe=False)

# 3. GET /api/produk/<id>
def get_produk_by_id(request, produk_id):
    prod = next((p for p in produk_db if p["id"] == int(produk_id)), None)
    if not prod:
        return JsonResponse({"code": -32602, "message": "Produk tidak ditemukan"}, status=404)
    return JsonResponse(prod)

# 4. GET /api/order
def get_all_orders(request):
    return JsonResponse(orders_db, safe=False)

# Helper pemrosesan order internal
def _process_order(id_produk, jumlah):
    prod = next((p for p in produk_db if p["id"] == int(id_produk)), None)
    if not prod:
        return None, {"code": -32602, "message": "Produk tidak ditemukan"}, 404
    if prod["stok"] < int(jumlah):
        return None, {"code": -32000, "message": "stok tidak cukup"}, 409

    prod["stok"] -= int(jumlah)
    new_order = {
        "id": len(orders_db) + 1,
        "id_produk": prod["id"],
        "jumlah": int(jumlah),
        "total": prod["harga"] * int(jumlah)
    }
    orders_db.append(new_order)
    return new_order, None, 200

# 5. POST /api/order (Direct Order)
@csrf_exempt
def create_order(request):
    if request.method != 'POST':
        return HttpResponseBadRequest("Method not allowed")
    try:
        body = json.loads(request.body)
        id_produk = body.get("id_produk")
        jumlah = body.get("jumlah", 1)
    except Exception:
        return JsonResponse({"code": -32700, "message": "Parse error"}, status=400)

    order, error, status_code = _process_order(id_produk, jumlah)
    if error:
        return JsonResponse(error, status=status_code)
    return JsonResponse(order)

# 6. POST /api/order/sync (Blocking sleep 200ms)
@csrf_exempt
def create_order_sync(request):
    if request.method != 'POST':
        return HttpResponseBadRequest("Method not allowed")
    try:
        body = json.loads(request.body)
        id_produk = body.get("id_produk")
        jumlah = body.get("jumlah", 1)
    except Exception:
        return JsonResponse({"code": -32700, "message": "Parse error"}, status=400)

    time.sleep(0.2) # Sleep 200ms
    order, error, status_code = _process_order(id_produk, jumlah)
    if error:
        return JsonResponse(error, status=status_code)
    return JsonResponse(order)

# 7. POST /api/order/async (HTTP 202 Accepted + Background Thread)
@csrf_exempt
def create_order_async(request):
    if request.method != 'POST':
        return HttpResponseBadRequest("Method not allowed")
    try:
        body = json.loads(request.body)
        id_produk = body.get("id_produk")
        jumlah = body.get("jumlah", 1)
    except Exception:
        return JsonResponse({"code": -32700, "message": "Parse error"}, status=400)

    job_id = f"job_{int(time.time() * 1000)}_{random.randint(100, 999)}"
    jobs_db[job_id] = {
        "jobId": job_id,
        "status": "pending"
    }

    def background_worker():
        time.sleep(0.2) # Sleep 200ms
        order, error, status_code = _process_order(id_produk, jumlah)
        if error:
            jobs_db[job_id] = {
                "jobId": job_id,
                "status": "error",
                "httpStatus": status_code,
                "error": error
            }
        else:
            jobs_db[job_id] = {
                "jobId": job_id,
                "status": "done",
                "result": order
            }

    thread = threading.Thread(target=background_worker)
    thread.daemon = True
    thread.start()

    return JsonResponse({
        "jobId": job_id,
        "status": "pending",
        "message": "Order sedang diproses di latar belakang"
    }, status=202)

# 8. GET /api/order/status/<jobId>
def get_job_status(request, job_id):
    job = jobs_db.get(job_id)
    if not job:
        return JsonResponse({"error": "Job ID tidak ditemukan"}, status=404)
    return JsonResponse(job)
