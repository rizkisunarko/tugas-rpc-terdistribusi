<?php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: *");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$storageFile = __DIR__ . '/orders_data.json';

function getOrders($storageFile) {
    if (!file_exists($storageFile)) {
        return [];
    }
    $content = file_get_contents($storageFile);
    $data = json_decode($content, true);
    return is_array($data) ? $data : [];
}

function saveOrders($storageFile, $orders) {
    file_put_contents($storageFile, json_encode($orders, JSON_PRETTY_PRINT));
}

function sendJsonRpcError($code, $message, $id = null) {
    echo json_encode([
        "jsonrpc" => "2.0",
        "error" => [
            "code" => $code,
            "message" => $message
        ],
        "id" => $id
    ]);
    exit();
}

function sendJsonRpcResult($result, $id = null) {
    echo json_encode([
        "jsonrpc" => "2.0",
        "result" => $result,
        "id" => $id
    ]);
    exit();
}

// Fungsi komunikasi JSON-RPC HTTP POST ke Python Service Produk (:5001/rpc)
function callPythonService($method, $params) {
    $url = "http://localhost:5001/rpc";
    $payload = json_encode([
        "jsonrpc" => "2.0",
        "method" => $method,
        "params" => $params,
        "id" => time()
    ]);

    $options = [
        'http' => [
            'header'  => "Content-Type: application/json\r\n",
            'method'  => 'POST',
            'content' => $payload,
            'timeout' => 5
        ]
    ];
    
    $context = stream_context_create($options);
    $result = @file_get_contents($url, false, $context);
    if ($result === FALSE) {
        return null;
    }
    return json_decode($result, true);
}

$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true);

if (!$body || !is_array($body)) {
    sendJsonRpcError(-32700, "Parse error (Invalid JSON)");
}

$jsonrpc = $body['jsonrpc'] ?? null;
$method = $body['method'] ?? null;
$params = $body['params'] ?? [];
$id = $body['id'] ?? null;

if ($jsonrpc !== "2.0" || !$method) {
    sendJsonRpcError(-32600, "Invalid Request format", $id);
}

// Method 1: listOrder
if ($method === "listOrder") {
    $orders = getOrders($storageFile);
    sendJsonRpcResult($orders, $id);
}

// Helper logika pemesanan (validasi stok ke Python, hitung total, simpan order)
function processOrder($params, $id, $storageFile) {
    if (!isset($params['id_produk']) || !isset($params['jumlah'])) {
        sendJsonRpcError(-32602, "params salah/tidak ditemukan", $id);
    }

    $id_produk = (int)$params['id_produk'];
    $jumlah = (int)$params['jumlah'];

    if ($jumlah <= 0) {
        sendJsonRpcError(-32602, "params salah/tidak ditemukan (jumlah harus > 0)", $id);
    }

    // Panggil Service Produk (Python :5001/rpc) via JSON-RPC
    $pythonResponse = callPythonService("kurangiStok", [
        "id" => $id_produk,
        "jumlah" => $jumlah
    ]);

    if (!$pythonResponse) {
        sendJsonRpcError(-32602, "Service Produk tidak dapat dijangkau", $id);
    }

    // Jika Python mengembalikan error (misal: -32000 stok tidak cukup / -32602 produk tidak ada)
    if (isset($pythonResponse['error'])) {
        $errCode = $pythonResponse['error']['code'] ?? -32602;
        $errMsg = $pythonResponse['error']['message'] ?? "Gagal memproses order";
        sendJsonRpcError($errCode, $errMsg, $id);
    }

    $produk = $pythonResponse['result'];
    $total = $produk['harga'] * $jumlah;

    $orders = getOrders($storageFile);
    $newOrder = [
        "id" => count($orders) + 1,
        "id_produk" => $id_produk,
        "jumlah" => $jumlah,
        "total" => $total
    ];

    $orders[] = $newOrder;
    saveOrders($storageFile, $orders);

    sendJsonRpcResult($newOrder, $id);
}

// Method 2: buatOrder
if ($method === "buatOrder") {
    processOrder($params, $id, $storageFile);
}

// Method 3: buatOrderSync (sleep 200ms lalu buat order)
if ($method === "buatOrderSync") {
    usleep(200000); // Delay 200ms (200,000 microsecond)
    processOrder($params, $id, $storageFile);
}

// Method tidak ditemukan
sendJsonRpcError(-32601, "method tidak ada", $id);
