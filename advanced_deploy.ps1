# Advanced Deployment Script for Life-Orchestrator
# Separates Build and Deploy for better reliability and debugging

$gcloud = "C:\Users\ismai\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
$project = "gen-lang-client-0913875211"
$region = "us-central1"
$repoName = "life-orchestrator-repo"
$imageName = "life-orchestrator-app"
$serviceName = "life-orchestrator"

# ---------------------------------------------------------------------------
# Read GEMINI_API_KEY from .env.local — it is passed as a Cloud Run runtime
# environment variable so it is NEVER baked into the container image.
# IMPORTANT: Rotate/replace this key in .env.local before deploying if the
# previous key was compromised.
# ---------------------------------------------------------------------------
$envFile = ".env.local"
$geminiKey = ""
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
        if ($line -match "^GEMINI_API_KEY=(.+)$") {
            $geminiKey = $matches[1].Trim()
            break
        }
    }
}

if (-not $geminiKey) {
    Write-Host "ERROR: GEMINI_API_KEY not found in .env.local. Add it and retry." -ForegroundColor Red
    exit 1
}

Write-Host "1. Enabling required APIs..."
& $gcloud services enable artifactregistry.googleapis.com run.googleapis.com cloudbuild.googleapis.com --project $project

Write-Host "2. Creating Artifact Registry Repository (if not exists)..."
# Try to create, ignore error if already exists
& $gcloud artifacts repositories create $repoName --repository-format=docker --location=$region --description="Repo for Life Orchestrator" --project $project 2>$null

$imageUrl = "$region-docker.pkg.dev/$project/$repoName/$imageName"

Write-Host "3. Configuring Docker auth for Artifact Registry..."
& $gcloud auth configure-docker "$region-docker.pkg.dev" --quiet --project $project

Write-Host "4. Building Container Image locally (bypasses Cloud Build)..."
Write-Host "Image URL: $imageUrl"
docker build -t $imageUrl .

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build Successful."

    Write-Host "5. Pushing image to Artifact Registry..."
    docker push $imageUrl

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Push Successful."

        Write-Host "6. Deploying to Cloud Run (GEMINI_API_KEY passed as secure env var)..."
        & $gcloud run deploy $serviceName `
            --image $imageUrl `
            --region $region `
            --allow-unauthenticated `
            --set-env-vars "GEMINI_API_KEY=$geminiKey" `
            --project $project
    } else {
        Write-Host "Push Failed. Aborting deployment." -ForegroundColor Red
    }
} else {
    Write-Host "Build Failed. Aborting deployment." -ForegroundColor Red
}
