<?php
declare(strict_types=1);
require __DIR__.'/csv.php';
$path=parse_url($_SERVER['REQUEST_URI'] ?? '/',PHP_URL_PATH);
$method=$_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($path==='/health' && $method==='GET') { header('Content-Type: application/json'); echo '{"status":"ok","service":"fenix-reports"}'; return; }
if ($path!=='/export') { http_response_code(404); return; }
if ($method!=='POST') { http_response_code(405);header('Allow: POST');return; }
$token=getenv('REPORT_SERVICE_TOKEN') ?: '';
$auth=$_SERVER['HTTP_AUTHORIZATION'] ?? '';
if ($token==='' || !hash_equals('Bearer '.$token,$auth)) { http_response_code(401);return; }
header('Cache-Control: no-store');
try {
    $body=file_get_contents('php://input');
    if (strlen($body)>6000000) throw new InvalidArgumentException('Solicitação muito grande.');
    $data=json_decode($body,true,64,JSON_THROW_ON_ERROR);
    if (!is_array($data)) throw new InvalidArgumentException('Objeto JSON esperado.');
    $csv=buildCsv($data);
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="fenix-equipamentos.csv"');
    echo $csv;
} catch (Throwable $e) {
    http_response_code(400);header('Content-Type: application/json');echo '{"error":"Dados de relatório inválidos."}';
}
