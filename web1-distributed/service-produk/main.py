from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Service Produk (Python JSON-RPC)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory database produk sesuai spesifikasi
produk_db = [
    {"id": 1, "nama": "Kopi", "harga": 15000, "stok": 50},
    {"id": 2, "nama": "Teh", "harga": 10000, "stok": 80},
    {"id": 3, "nama": "Susu", "harga": 12000, "stok": 30}
]

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

    # Validasi request JSON-RPC 2.0
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
        
        try:
            prod_id = int(params["id"])
        except ValueError:
            return make_jsonrpc_response(
                error={"code": -32602, "message": "params 'id' harus angka"},
                req_id=req_id
            )

        produk = next((p for p in produk_db if p["id"] == prod_id), None)
        if not produk:
            return make_jsonrpc_response(
                error={"code": -32602, "message": "params salah/tidak ditemukan (Produk ID tidak ada)"},
                req_id=req_id
            )

        return make_jsonrpc_response(result=produk, req_id=req_id)

    # Method 3: kurangiStok (Helper internal RPC untuk pemesanan)
    elif method == "kurangiStok":
        if not isinstance(params, dict) or "id" not in params or "jumlah" not in params:
            return make_jsonrpc_response(
                error={"code": -32602, "message": "params salah/tidak ditemukan"},
                req_id=req_id
            )
        
        try:
            prod_id = int(params["id"])
            jumlah = int(params["jumlah"])
        except ValueError:
            return make_jsonrpc_response(
                error={"code": -32602, "message": "params 'id' dan 'jumlah' harus berupa angka"},
                req_id=req_id
            )

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
        return make_jsonrpc_response(result=produk, req_id=req_id)

    # Method tidak dikenal
    else:
        return make_jsonrpc_response(
            error={"code": -32601, "message": "method tidak ada"},
            req_id=req_id
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
