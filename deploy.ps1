# Deployment Script for Life-Orchestrator

# Path to gcloud executable
$gcloudPath = "C:\Users\ismai\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"

# Check if gcloud exists at specific path, otherwise try generic 'gcloud'
if (-not (Test-Path $gcloudPath)) {
    Write-Host "Specific gcloud path not found, trying global 'gcloud'..."
    $gcloudPath = "gcloud"
}

Write-Host "Deploying using: $gcloudPath"

# Deploy command
& $gcloudPath run deploy life-orchestrator --source . --region us-central1 --allow-unauthenticated
