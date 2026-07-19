# Cloud build path — build both images in AWS CodeBuild so no local Docker is
# needed. Source is a zip you upload to S3 (a clean `git archive` of the repo).

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "source" {
  bucket        = "${var.name_prefix}-source-${data.aws_caller_identity.current.account_id}"
  force_destroy = true
}

data "aws_iam_policy_document" "codebuild_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["codebuild.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "codebuild" {
  name               = "${var.name_prefix}-codebuild"
  assume_role_policy = data.aws_iam_policy_document.codebuild_assume.json
}

resource "aws_iam_role_policy" "codebuild" {
  name = "build"
  role = aws_iam_role.codebuild.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:GetObjectVersion"]
        Resource = "${aws_s3_bucket.source.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload", "ecr:PutImage", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"
        ]
        Resource = [aws_ecr_repository.app.arn, aws_ecr_repository.mongo.arn]
      }
    ]
  })
}

resource "aws_codebuild_project" "build" {
  name         = "${var.name_prefix}-build"
  service_role = aws_iam_role.codebuild.arn

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    compute_type    = "BUILD_GENERAL1_MEDIUM"
    image           = "aws/codebuild/standard:7.0"
    type            = "LINUX_CONTAINER"
    privileged_mode = true # needed to run docker builds

    environment_variable {
      name  = "ACCOUNT"
      value = data.aws_caller_identity.current.account_id
    }
    environment_variable {
      name  = "APP_REPO"
      value = aws_ecr_repository.app.repository_url
    }
    environment_variable {
      name  = "MONGO_REPO"
      value = aws_ecr_repository.mongo.repository_url
    }
    environment_variable {
      name  = "APP_TAG"
      value = var.app_image_tag
    }
    environment_variable {
      name  = "MONGO_TAG"
      value = var.mongo_image_tag
    }
  }

  source {
    type      = "S3"
    location  = "${aws_s3_bucket.source.bucket}/source.zip"
    buildspec = file("${path.module}/buildspec.yml")
  }
}
