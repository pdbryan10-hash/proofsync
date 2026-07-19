output "alb_url" {
  description = "Public URL of the demo."
  value       = "http://${aws_lb.app.dns_name}"
}

output "ecr_app_repository_url" {
  description = "Push the app image here."
  value       = aws_ecr_repository.app.repository_url
}

output "ecr_mongo_repository_url" {
  description = "Push the mongo image here."
  value       = aws_ecr_repository.mongo.repository_url
}

output "cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "codebuild_project" {
  description = "CodeBuild project that builds both images (cloud build path)."
  value       = aws_codebuild_project.build.name
}

output "source_bucket" {
  description = "S3 bucket to upload the source zip to before starting the build."
  value       = aws_s3_bucket.source.bucket
}

output "cron_secret" {
  description = "Bearer token for the demo reset/seed endpoint. `terraform output -raw cron_secret`."
  value       = random_password.cron.result
  sensitive   = true
}

output "region" {
  value = var.region
}
