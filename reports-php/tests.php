<?php
declare(strict_types=1);
require __DIR__ . '/csv.php';
function check(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
$record = ['serial'=>'=HYPERLINK("bad")','kind'=>'Câmera','status'=>'Operacional','agency'=>'Trânsito','neighborhood'=>'Centro; Norte','region'=>'Central','maintenance'=>'Nenhuma'];
$csv = buildCsv(['version'=>1,'rows'=>[$record]]);
check(str_contains($csv,"'="), 'Fórmulas devem ser neutralizadas');
check(str_contains($csv,'Trânsito'), 'UTF-8 precisa ser preservado');
check(str_contains($csv,'"Centro; Norte"'), 'Separadores devem ser escapados');
foreach ([['rows'=>[]],['version'=>1,'rows'=>array_fill(0,5001,$record)],['version'=>1,'rows'=>['inválido']]] as $bad) {
    $thrown=false; try { buildCsv($bad); } catch (InvalidArgumentException $e) { $thrown=true; }
    check($thrown,'Contrato inválido deve ser rejeitado');
}
check(substr_count(buildCsv(['version'=>1,'rows'=>[]]),"\n")===1,'Lista vazia deve gerar apenas cabeçalho');
check(str_contains(buildCsv(['version'=>1,'rows'=>[$record+['extra'=>'ignorado']]]),'ignorado')===false,'Campo extra não deve vazar');
echo "8 verificações PHP passaram.\n";
