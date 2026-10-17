<?php

declare(strict_types=1);

require __DIR__ . '/csv.php';

const MAX_REQUEST_BYTES = 6000000;

function jsonResponse(int $status, array $body): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($path === '/health' && $method === 'GET') {
    jsonResponse(200, ['status' => 'ok', 'service' => 'fenix-reports']);
    return;
}
if ($path !== '/export') {
    http_response_code(404);
    return;
}
if ($method !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    return;
}
$token = getenv('REPORT_SERVICE_TOKEN') ?: '';
$authorization = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if ($token === '' || !hash_equals('Bearer ' . $token, $authorization)) {
    http_response_code(401);
    return;
}
header('Cache-Control: no-store');
try {
    $body = file_get_contents('php://input', false, null, 0, MAX_REQUEST_BYTES + 1);
    if ($body === false) {
        throw new RuntimeException('Não foi possível ler a solicitação.');
    }
    if (strlen($body) > MAX_REQUEST_BYTES) {
        throw new InvalidArgumentException('Solicitação muito grande.');
    }
    $data = json_decode($body, true, 64, JSON_THROW_ON_ERROR);
    if (!is_array($data)) {
        throw new InvalidArgumentException('Objeto JSON esperado.');
    }
    $csv = buildCsv($data);
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="fenix-equipamentos.csv"');
    echo $csv;
} catch (InvalidArgumentException | JsonException $error) {
    jsonResponse(400, ['error' => 'Dados de relatório inválidos.']);
} catch (Throwable $error) {
    jsonResponse(500, ['error' => 'Serviço de relatórios indisponível.']);
}
