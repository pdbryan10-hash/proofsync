# In-VPC MongoDB: a single-node replica set on Fargate, persisted on EFS, and
# discoverable at mongo.proofsync.local. This is what "all the DBs mirrored" means
# — the app seeds its three databases straight into here.

resource "aws_cloudwatch_log_group" "mongo" {
  name              = "/ecs/${var.name_prefix}/mongo"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${var.name_prefix}/app"
  retention_in_days = 14
}

# --- persistence -------------------------------------------------------------
resource "aws_efs_file_system" "mongo" {
  creation_token = "${var.name_prefix}-mongo"
  encrypted      = true
  tags           = { Name = "${var.name_prefix}-mongo" }
}

resource "aws_efs_mount_target" "mongo" {
  count           = 2
  file_system_id  = aws_efs_file_system.mongo.id
  subnet_id       = aws_subnet.private[count.index].id
  security_groups = [aws_security_group.efs.id]
}

# Mongo runs as uid/gid 999; the access point pins ownership so writes succeed.
resource "aws_efs_access_point" "mongo" {
  file_system_id = aws_efs_file_system.mongo.id
  posix_user {
    uid = 999
    gid = 999
  }
  root_directory {
    path = "/mongo"
    creation_info {
      owner_uid   = 999
      owner_gid   = 999
      permissions = "0755"
    }
  }
}

# --- service discovery -------------------------------------------------------
resource "aws_service_discovery_private_dns_namespace" "main" {
  name = "proofsync.local"
  vpc  = aws_vpc.main.id
}

resource "aws_service_discovery_service" "mongo" {
  name = "mongo"
  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.main.id
    routing_policy = "MULTIVALUE"
    dns_records {
      ttl  = 10
      type = "A"
    }
  }
  health_check_custom_config {
    failure_threshold = 1
  }
}

# --- task + service ----------------------------------------------------------
resource "aws_ecs_task_definition" "mongo" {
  family                   = "${var.name_prefix}-mongo"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.mongo_cpu
  memory                   = var.mongo_memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  volume {
    name = "mongo-data"
    efs_volume_configuration {
      file_system_id     = aws_efs_file_system.mongo.id
      transit_encryption = "ENABLED"
      authorization_config {
        access_point_id = aws_efs_access_point.mongo.id
        iam             = "DISABLED"
      }
    }
  }

  container_definitions = jsonencode([{
    name         = "mongo"
    image        = "${aws_ecr_repository.mongo.repository_url}:${var.mongo_image_tag}"
    essential    = true
    portMappings = [{ containerPort = 27017, protocol = "tcp" }]
    environment = [
      { name = "MONGO_ADVERTISED_HOST", value = "${aws_service_discovery_service.mongo.name}.${aws_service_discovery_private_dns_namespace.main.name}" },
      { name = "RS_NAME", value = "rs0" }
    ]
    mountPoints = [{ sourceVolume = "mongo-data", containerPath = "/data/db" }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.mongo.name
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "mongo"
      }
    }
  }])
}

resource "aws_ecs_service" "mongo" {
  name            = "${var.name_prefix}-mongo"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.mongo.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  # Single node — never run two at once over the same EFS / replica set.
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.mongo.id]
    assign_public_ip = false
  }

  service_registries {
    registry_arn = aws_service_discovery_service.mongo.arn
  }

  depends_on = [aws_efs_mount_target.mongo]
}
