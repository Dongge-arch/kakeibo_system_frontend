[CmdletBinding()]
param(
    [string]$Profile = "receipt-dev",
    [string]$Region = "ap-southeast-1",
    [string]$Bucket = "home-kakeibo-frontend-sg",
    [string]$DistributionId = "E2ZX0HKJ3N51W1"
)

$ErrorActionPreference = "Stop"
$frontendDirectory = Join-Path $PSScriptRoot "frontend-react"
$distDirectory = Join-Path $frontendDirectory "dist"
$bucketUri = "s3://$Bucket"

function Assert-LastExitCode {
    param([string]$Operation)

    if ($LASTEXITCODE -ne 0) {
        throw "$Operation に失敗しました。終了コード: $LASTEXITCODE"
    }
}

Write-Host "[1/6] 本番用フロントエンドをビルドします。"
Push-Location $frontendDirectory
try {
    & npm run build
    Assert-LastExitCode "フロントエンドビルド"
}
finally {
    Pop-Location
}

if (-not (Test-Path -LiteralPath (Join-Path $distDirectory "index.html"))) {
    throw "ビルド成果物 index.html が見つかりません。"
}

# 2026-11-05 Codex: 上書き前のオンライン版を必ず保存し、バックアップ失敗時は配布を中止する。
$commitId = (& git -C $PSScriptRoot rev-parse --short HEAD).Trim()
Assert-LastExitCode "Gitコミット番号の取得"
$backupName = "{0}-{1}" -f (Get-Date -Format "yyyyMMdd-HHmmss"), $commitId
$backupUri = "$bucketUri/bk/$backupName"

Write-Host "[2/6] 現在のオンライン版を $backupUri へバックアップします。"
& aws s3api head-object --bucket $Bucket --key "index.html" --profile $Profile --region $Region | Out-Null
Assert-LastExitCode "オンライン版の確認"
& aws s3 cp "$bucketUri/" "$backupUri/" --recursive --exclude "bk/*" --profile $Profile --region $Region
Assert-LastExitCode "オンライン版のバックアップ"
& aws s3api head-object --bucket $Bucket --key "bk/$backupName/index.html" --profile $Profile --region $Region | Out-Null
Assert-LastExitCode "バックアップ結果の確認"

# 2026-11-05 Codex: ハッシュ付き旧資源だけを削除し、bk配下の回復用データには触れない。
Write-Host "[3/6] 旧assetsを整理します。"
& aws s3 rm "$bucketUri/assets/" --recursive --profile $Profile --region $Region
Assert-LastExitCode "旧assetsの整理"

Write-Host "[4/6] 新しい静的ファイルをアップロードします。"
& aws s3 sync $distDirectory $bucketUri --profile $Profile --region $Region
Assert-LastExitCode "S3アップロード"

Write-Host "[5/6] CloudFrontキャッシュを更新します。"
$invalidationId = (& aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/*" --profile $Profile --query "Invalidation.Id" --output text).Trim()
Assert-LastExitCode "CloudFrontキャッシュ削除の開始"
& aws cloudfront wait invalidation-completed --distribution-id $DistributionId --id $invalidationId --profile $Profile
Assert-LastExitCode "CloudFrontキャッシュ削除の完了待機"

Write-Host "[6/6] デプロイが完了しました。"
Write-Host "Backup: $backupUri"
Write-Host "Invalidation: $invalidationId"
