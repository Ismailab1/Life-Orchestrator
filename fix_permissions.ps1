# Fix IAM Permissions for Life-Orchestrator Deployment

$gcloud = "C:\Users\ismai\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
$project = "gen-lang-client-0913875211"
$sa = "662200881058-compute@developer.gserviceaccount.com"

Write-Host "1. Enabling Cloud Build API..."
& $gcloud services enable cloudbuild.googleapis.com --project $project

Write-Host "2. Granting Cloud Build Builder role to Service Account..."
& $gcloud projects add-iam-policy-binding $project --member="serviceAccount:$sa" --role="roles/cloudbuild.builds.builder"

Write-Host "3. Granting Storage Object Viewer role to Service Account..."
& $gcloud projects add-iam-policy-binding $project --member="serviceAccount:$sa" --role="roles/storage.objectViewer"

Write-Host "Permissions updated. You can now try deploying again."
