$connStr = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=e:\Soft\DrCreate\Clinicore\Cache\AshrafKhan.accdb;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()
$tables = $conn.GetSchema("Tables")
$res = @{}
foreach ($r in $tables.Rows) {
    if ($r["TABLE_TYPE"] -eq "TABLE") {
        $tName = $r["TABLE_NAME"]
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = "SELECT * FROM [$tName]"
        $da = New-Object System.Data.OleDb.OleDbDataAdapter($cmd)
        $dt = New-Object System.Data.DataTable
        [void]$da.Fill($dt)
        $rows = @()
        foreach ($row in $dt.Rows) {
            $obj = [ordered]@{}
            foreach ($col in $dt.Columns) {
                $obj[$col.ColumnName] = [string]$row[$col.ColumnName]
            }
            $rows += $obj
        }
        $res[$tName] = $rows
        Write-Host "Extracted $tName ($($rows.Count) rows)"
    }
}
$conn.Close()

$jsonOut = $res | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText("e:\Soft\DrCreate\Clinicore\scratch_access_dump.json", $jsonOut, [System.Text.Encoding]::UTF8)
Write-Host "Saved to scratch_access_dump.json"
