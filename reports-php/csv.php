<?php
declare(strict_types=1);
function buildCsv(array $payload): string {
    if (($payload['version'] ?? null) !== 1 || !isset($payload['rows']) || !is_array($payload['rows']) || !array_is_list($payload['rows']) || count($payload['rows']) > 5000) {
        throw new InvalidArgumentException('Contrato inválido ou limite de 5.000 linhas excedido.');
    }
    $fields=['serial'=>'Número de série','kind'=>'Tipo','status'=>'Situação','agency'=>'Órgão','neighborhood'=>'Bairro','region'=>'Região','maintenance'=>'Manutenção'];
    $stream=fopen('php://temp','r+');
    fwrite($stream,"\xEF\xBB\xBF");
    fputcsv($stream,array_values($fields),';','"','');
    foreach ($payload['rows'] as $record) {
        if (!is_array($record)) throw new InvalidArgumentException('Linha inválida.');
        $row=[];
        foreach ($fields as $key=>$label) {
            $value=$record[$key] ?? '';
            if (!is_scalar($value) && $value!==null) throw new InvalidArgumentException('Campo inválido.');
            $value=(string)$value;
            if (preg_match('/^[\x00-\x20]*[=+@\-]/u',$value) || preg_match('/^[\t\r\n]/',$value)) $value="'".$value;
            $row[]=$value;
        }
        fputcsv($stream,$row,';','"','');
    }
    rewind($stream);$result=stream_get_contents($stream);fclose($stream);
    return $result;
}
