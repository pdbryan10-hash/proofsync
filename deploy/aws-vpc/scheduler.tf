# Backstop beat: once a minute, run a throwaway task (the app image) that curls
# the demo-tick route so the sync advances even with no console open. The console
# itself self-ticks every ~30s when someone's watching.

resource "aws_ecs_task_definition" "tick" {
  count                    = var.enable_tick_scheduler ? 1 : 0
  family                   = "${var.name_prefix}-tick"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name      = "tick"
    image     = "${aws_ecr_repository.app.repository_url}:${var.app_image_tag}"
    essential = true
    command = [
      "node", "-e",
      "fetch('http://'+process.env.ALB+'/api/cron/demo-tick?key='+process.env.CRON_SECRET).then(r=>r.text()).then(t=>console.log('tick',t)).catch(e=>{console.error(e);process.exit(1)})"
    ]
    environment = [{ name = "ALB", value = aws_lb.app.dns_name }]
    secrets     = [{ name = "CRON_SECRET", valueFrom = "${aws_secretsmanager_secret.app.arn}:CRON_SECRET::" }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.app.name
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "tick"
      }
    }
  }])
}

resource "aws_scheduler_schedule" "tick" {
  count = var.enable_tick_scheduler ? 1 : 0
  name  = "${var.name_prefix}-tick"

  flexible_time_window {
    mode = "OFF"
  }
  schedule_expression = "rate(1 minute)"

  target {
    arn      = aws_ecs_cluster.main.arn
    role_arn = aws_iam_role.scheduler[0].arn

    ecs_parameters {
      task_definition_arn = aws_ecs_task_definition.tick[0].arn
      launch_type         = "FARGATE"

      network_configuration {
        subnets          = aws_subnet.private[*].id
        security_groups  = [aws_security_group.app.id]
        assign_public_ip = false
      }
    }
  }
}
