# Two image repos: the app, and the single-node Mongo replica set.
# force_delete lets `terraform destroy` clean up even with images present.

resource "aws_ecr_repository" "app" {
  name                 = "${var.name_prefix}-app"
  image_tag_mutability = "MUTABLE"
  force_delete         = true
  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "mongo" {
  name                 = "${var.name_prefix}-mongo"
  image_tag_mutability = "MUTABLE"
  force_delete         = true
}
