# Advanced Deployment Script for Life-Orchestrator
# Separates Build and Deploy for better reliability and debugging

$gcloud = "C:\Users\ismai\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
$project = "gen-lang-client-0913875211"
$region = "us-central1"
$repoName = "life-orchestrator-repo"
$imageName = "life-orchestrator-app"
$serviceName = "life-orchestrator"

Write-Host "1. Enabling required APIs..."
& $gcloud services enable artifactregistry.googleapis.com run.googleapis.com cloudbuild.googleapis.com --project $project

Write-Host "2. Creating Artifact Registry Repository (if not exists)..."
# Try to create, ignore error if already exists
& $gcloud artifacts repositories create $repoName --repository-format=docker --location=$region --description="Repo for Life Orchestrator" --project $project 2>$null

$imageUrl = "$region-docker.pkg.dev/$project/$repoName/$imageName"

Write-Host "3. Building Container Image..."
Write-Host "Image URL: $imageUrl"
& $gcloud builds submit --tag $imageUrl --project $project

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build Successful."
    
    Write-Host "4. Deploying to Cloud Run..."
    & $gcloud run deploy $serviceName --image $imageUrl --region $region --allow-unauthenticated --project $project
} else {
    Write-Host "Build Failed. Aborting deployment."
}
