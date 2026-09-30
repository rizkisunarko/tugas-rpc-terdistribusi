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

function callPythonService($method, $params) {
    $url = "http://127.0.0.1:5001/rpc";
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

// Helper logika pemesanan dengan potongan Diskon ML (Linear Regression)
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

    if (isset($pythonResponse['error'])) {
        $errCode = $pythonResponse['error']['code'] ?? -32602;
        $errMsg = $pythonResponse['error']['message'] ?? "Gagal memproses order";
        sendJsonRpcError($errCode, $errMsg, $id);
    }

    $produk = $pythonResponse['result'];
    $subtotal = $produk['harga'] * $jumlah;
    $diskon_persen = isset($produk['diskon_persen']) ? (float)$produk['diskon_persen'] : 0.0;
    $total_diskon = round($subtotal * ($diskon_persen / 100.0));
    $total = $subtotal - $total_diskon;

    $orders = getOrders($storageFile);
    $newOrder = [
        "id" => count($orders) + 1,
        "id_produk" => $id_produk,
        "jumlah" => $jumlah,
        "subtotal" => $subtotal,
        "diskon_persen" => $diskon_persen,
        "total_diskon" => $total_diskon,
        "total" => $total
    ];

    $orders[] = $newOrder;
    saveOrders($storageFile, $orders);

    sendJsonRpcResult($newOrder, $id);
}

if ($method === "buatOrder") {
    processOrder($params, $id, $storageFile);
}

if ($method === "buatOrderSync") {
    usleep(200000);
    processOrder($params, $id, $storageFile);
}

sendJsonRpcError(-32601, "method tidak ada", $id);
