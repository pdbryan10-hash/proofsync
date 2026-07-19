# The app's sensitive env, held in Secrets Manager and injected into the task.
# DATABASE_URL points at the in-VPC Mongo via its Cloud Map DNS name; a single URL
# serves Prisma (see_cafm_sync) and the two stand-in demo databases (by name).

resource "random_password" "cron" {
  length  = 40
  special = false # URL-safe: it's also passed as a query param to the tick route
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.name_prefix}-app-env"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    DATABASE_URL = "mongodb://${aws_service_discovery_service.mongo.name}.${aws_service_discovery_private_dns_namespace.main.name}:27017/see_cafm_sync?replicaSet=rs0"
    CRON_SECRET  = random_password.cron.result
  })
}
