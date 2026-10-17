<?php

declare(strict_types=1);

const REPORT_VERSION = 1;
const MAX_REPORT_ROWS = 5000;
const CSV_COLUMNS = [
    'serial' => 'Número de série',
    'kind' => 'Tipo',
    'status' => 'Situação',
    'agency' => 'Órgão',
    'neighborhood' => 'Bairro',
    'region' => 'Região',
    'maintenance' => 'Manutenção',
];

function validateReportPayload(array $payload): void
{
    $rows = $payload['rows'] ?? null;
    if (
        ($payload['version'] ?? null) !== REPORT_VERSION
        || !is_array($rows)
        || !array_is_list($rows)
        || count($rows) > MAX_REPORT_ROWS
    ) {
        throw new InvalidArgumentException('Contrato inválido ou limite de 5.000 linhas excedido.');
    }
}

function csvCell(mixed $value): string
{
    if (!is_scalar($value) && $value !== null) {
        throw new InvalidArgumentException('Campo inválido.');
    }
    $text = (string) $value;
    $startsFormula = preg_match('/^[\x00-\x20]*[=+@\-]/u', $text);
    $startsControl = preg_match('/^[\t\r\n]/', $text);
    return $startsFormula || $startsControl ? "'" . $text : $text;
}

function buildCsv(array $payload): string
{
    validateReportPayload($payload);
    $stream = fopen('php://temp', 'r+');
    if ($stream === false) {
        throw new RuntimeException('Não foi possível preparar o relatório.');
    }
    try {
        fwrite($stream, "\xEF\xBB\xBF");
        fputcsv($stream, array_values(CSV_COLUMNS), ';', '"', '');
        foreach ($payload['rows'] as $record) {
            if (!is_array($record)) {
                throw new InvalidArgumentException('Linha inválida.');
            }
            $row = [];
            foreach (CSV_COLUMNS as $key => $label) {
                $row[] = csvCell($record[$key] ?? '');
            }
            fputcsv($stream, $row, ';', '"', '');
        }
        rewind($stream);
        $result = stream_get_contents($stream);
        if ($result === false) {
            throw new RuntimeException('Não foi possível ler o relatório.');
        }
        return $result;
    } finally {
        fclose($stream);
    }
}
