$connStr = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=e:\Soft\DrCreate\Clinicore\Cache\AshrafKhan.accdb;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()

$tables = @("Accounts", "Inventory", "Invextra")
foreach ($t in $tables) {
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT * FROM [$t]"
    $da = New-Object System.Data.OleDb.OleDbDataAdapter($cmd)
    $dt = New-Object System.Data.DataTable
    [void]$da.Fill($dt)
    $csvFile = "e:\Soft\DrCreate\Clinicore\$($t)_export.csv"
    $dt | Export-Csv -Path $csvFile -NoTypeInformation -Encoding UTF8
    Write-Host "Exported $t ($($dt.Rows.Count) rows) to $csvFile"
}
$conn.Close()
