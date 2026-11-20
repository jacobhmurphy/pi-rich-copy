$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Windows.Forms

$payload = ([Console]::In.ReadToEnd() | ConvertFrom-Json)
$data = [System.Windows.Forms.DataObject]::new()
$data.SetData([System.Windows.Forms.DataFormats]::Html, [string]$payload.cfHtml)
$data.SetData([System.Windows.Forms.DataFormats]::UnicodeText, [string]$payload.plainText)
[System.Windows.Forms.Clipboard]::SetDataObject($data, $true)
