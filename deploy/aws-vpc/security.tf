# ALB: public HTTP in. (Add 443 + ACM cert for TLS in production.)
resource "aws_security_group" "alb" {
  name   = "${var.name_prefix}-alb"
  vpc_id = aws_vpc.main.id

  ingress {
    description = "HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${var.name_prefix}-alb" }
}

# App tasks: reachable only from the ALB; free egress (Mongo, NAT).
resource "aws_security_group" "app" {
  name   = "${var.name_prefix}-app"
  vpc_id = aws_vpc.main.id

  ingress {
    description     = "App port from the ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${var.name_prefix}-app" }
}

# Mongo: reachable only from the app tasks.
resource "aws_security_group" "mongo" {
  name   = "${var.name_prefix}-mongo"
  vpc_id = aws_vpc.main.id

  ingress {
    description     = "MongoDB from app tasks"
    from_port       = 27017
    to_port         = 27017
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${var.name_prefix}-mongo" }
}

# EFS: NFS from the Mongo task only.
resource "aws_security_group" "efs" {
  name   = "${var.name_prefix}-efs"
  vpc_id = aws_vpc.main.id

  ingress {
    description     = "NFS from mongo tasks"
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = [aws_security_group.mongo.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${var.name_prefix}-efs" }
}
