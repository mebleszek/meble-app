# Offline only. No Google login, network, deploy, UI prompt or administrator role.
# DPAPI CurrentUser is NOT a fresh owner authentication: any process under this
# logged-on Windows account can use the key. Owner approval is procedural.
[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateSet('CreateKey', 'CheckKey', 'Sign')][string]$Action,
    [string]$KeyDirectory = (Join-Path $env:LOCALAPPDATA 'MebleApp-OwnerDeploymentKey-DPAPI-v1'),
    [string]$DecisionPath,
    [string]$ExpectedKeySha256,
    [string]$OutputFile,
    [switch]$OwnerApproved
)
$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'LF_SIGNING_WINDOWS_REQUIRED' }
$repoRoot = [IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent)).TrimEnd('\', '/')
function Outside-Repository([string]$Location) {
    $absolute = [IO.Path]::GetFullPath($Location)
    if ($absolute.Equals($repoRoot, [StringComparison]::OrdinalIgnoreCase) -or
        $absolute.StartsWith($repoRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'LF_SIGNING_PRIVATE_PATH_REQUIRED'
    }
    # Refuse junction/symlink aliases into the repository or another vault.
    $cursor = $absolute
    while ($cursor) {
        if (Test-Path -LiteralPath $cursor) {
            if ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
                throw 'LF_SIGNING_REPARSE_PATH_REFUSED'
            }
        }
        $parent = [IO.Path]::GetDirectoryName($cursor)
        if ($parent -eq $cursor) { break }; $cursor = $parent
    }
    return $absolute
}
function Worker([string]$Command, [hashtable]$Payload) {
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = (Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
    $info.UseShellExecute = $false; $info.CreateNoWindow = $true
    $info.RedirectStandardInput = $true; $info.RedirectStandardOutput = $true; $info.RedirectStandardError = $true
    $info.StandardInputEncoding = [Text.UTF8Encoding]::new($false)
    $info.ArgumentList.Add((Join-Path $PSScriptRoot 'application-owner-signing.cjs'))
    $info.ArgumentList.Add($Command)
    $process = [Diagnostics.Process]::new(); $process.StartInfo = $info
    try {
        $null = $process.Start()
        $stdout = $process.StandardOutput.ReadToEndAsync(); $stderr = $process.StandardError.ReadToEndAsync()
        $process.StandardInput.Write(($Payload | ConvertTo-Json -Depth 32 -Compress)); $process.StandardInput.Close()
        if (!$process.WaitForExit(15000)) { $process.Kill($true); throw 'LF_SIGNING_HELPER_TIMEOUT' }
        $result = $stdout.GetAwaiter().GetResult(); $errorText = $stderr.GetAwaiter().GetResult().Trim()
        if ($process.ExitCode -ne 0) {
            if ($errorText -cmatch '^LF_[A-Z0-9_]+$') { throw $errorText }
            throw 'LF_SIGNING_HELPER_FAILED'
        }
        try { return ($result | ConvertFrom-Json -AsHashtable) }
        catch { throw 'LF_SIGNING_HELPER_FORMAT_INVALID' }
    } finally { $result = ''; $process.Dispose() }
}
function Write-NewDurableFile([string]$Location, [byte[]]$Bytes) {
    $stream = [IO.FileStream]::new($Location, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try { $stream.Write($Bytes, 0, $Bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
}
function Fingerprint([byte[]]$Bytes) { return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($Bytes)).ToLowerInvariant() }
$vault = Outside-Repository $KeyDirectory
$vaultFile = Join-Path $vault 'deployment-key.dpapi.json'
$entropy = [Text.Encoding]::UTF8.GetBytes('MEBLE_APPLICATION_DEPLOYMENT_V1/DPAPI-CurrentUser/v1')
$scope = [Security.Cryptography.DataProtectionScope]::CurrentUser
$privateBytes = $null; $material = $null; $request = $null
try {
    if ($Action -eq 'CreateKey') {
        if (!$OwnerApproved) { throw 'LF_SIGNING_OWNER_APPROVAL_REQUIRED' }
        if (Test-Path -LiteralPath $vault) { throw 'LF_SIGNING_KEY_DIRECTORY_EXISTS' }
        $null = [IO.Directory]::CreateDirectory($vault)
        $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
        $acl = [Security.AccessControl.DirectorySecurity]::new()
        $acl.SetOwner($sid); $acl.SetAccessRuleProtection($true, $false)
        $rule = [Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit, ObjectInherit', 'None', 'Allow')
        $acl.AddAccessRule($rule); Set-Acl -LiteralPath $vault -AclObject $acl
        $material = Worker 'create' @{}
        $privateBytes = [Convert]::FromBase64String($material.privateKeyPkcs8)
        $protected = [Security.Cryptography.ProtectedData]::Protect($privateBytes, $entropy, $scope)
        $fingerprint = Fingerprint ([Convert]::FromBase64String($material.publicKeySpki))
        $record = @{version = 1; protection = 'DPAPI-CurrentUser'; keySha256 = $fingerprint;
            publicKeySpki = $material.publicKeySpki; privateKeyProtected = [Convert]::ToBase64String($protected)}
        Write-NewDurableFile $vaultFile ([Text.Encoding]::UTF8.GetBytes(($record | ConvertTo-Json -Compress)))
        # Verify the persisted ciphertext, not only the original in-memory pair.
        $ExpectedKeySha256 = $fingerprint
    }
    if ($ExpectedKeySha256 -cnotmatch '^[a-f0-9]{64}$') { throw 'LF_SIGNING_EXPECTED_KEY_REQUIRED' }
    if ($Action -eq 'Sign') {
        if (!$OwnerApproved) { throw 'LF_SIGNING_OWNER_APPROVAL_REQUIRED' }
        $output = Outside-Repository $OutputFile
        if (Test-Path -LiteralPath $output) { throw 'LF_SIGNING_OUTPUT_EXISTS' }
        $decision = Get-Content -LiteralPath $DecisionPath -Raw | ConvertFrom-Json -AsHashtable
        $null = Worker 'check' @{decision = $decision} # Before reading/unprotecting any key.
    }
    $saved = Get-Content -LiteralPath $vaultFile -Raw | ConvertFrom-Json -AsHashtable
    if ($saved.version -ne 1 -or $saved.protection -cne 'DPAPI-CurrentUser' -or
        $saved.keySha256 -cne $ExpectedKeySha256 -or
        (Fingerprint ([Convert]::FromBase64String($saved.publicKeySpki))) -cne $ExpectedKeySha256) {
        throw 'LF_SIGNING_KEY_UNTRUSTED'
    }
    if ($privateBytes) { [Array]::Clear($privateBytes, 0, $privateBytes.Length) }
    try { $privateBytes = [Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($saved.privateKeyProtected), $entropy, $scope) }
    catch { throw 'LF_SIGNING_KEY_UNAVAILABLE' }
    $request = @{privateKeyPkcs8 = [Convert]::ToBase64String($privateBytes); publicKeySpki = $saved.publicKeySpki; expectedKeySha256 = $ExpectedKeySha256}
    $null = Worker 'inspect' $request
    if ($Action -eq 'Sign') {
        $request.decision = $decision
        $signed = Worker 'sign' $request
        Write-NewDurableFile $output ([Text.Encoding]::UTF8.GetBytes(($signed | ConvertTo-Json -Depth 32) + "`n"))
        Write-Output "SIGNATURE_VERIFIED_NO_DEPLOYMENT keySha256=$ExpectedKeySha256"
    } else { Write-Output "DPAPI_KEY_VERIFIED keySha256=$ExpectedKeySha256" }
} finally {
    if ($privateBytes) { [Array]::Clear($privateBytes, 0, $privateBytes.Length) }
    if ($material) { $material.privateKeyPkcs8 = ''; $material.Clear() }
    if ($request) { $request.privateKeyPkcs8 = ''; $request.Clear() }
}
