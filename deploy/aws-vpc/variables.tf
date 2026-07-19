variable "region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "eu-west-2"
}

variable "name_prefix" {
  description = "Prefix for all resource names."
  type        = string
  default     = "proofsync-demo"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "app_image_tag" {
  description = "Tag of the app image already pushed to the app ECR repo."
  type        = string
  default     = "latest"
}

variable "mongo_image_tag" {
  description = "Tag of the mongo image already pushed to the mongo ECR repo."
  type        = string
  default     = "latest"
}

variable "app_cpu" {
  description = "Fargate CPU units for the app task."
  type        = number
  default     = 512
}

variable "app_memory" {
  description = "Fargate memory (MiB) for the app task."
  type        = number
  default     = 1024
}

variable "mongo_cpu" {
  description = "Fargate CPU units for the mongo task."
  type        = number
  default     = 512
}

variable "mongo_memory" {
  description = "Fargate memory (MiB) for the mongo task."
  type        = number
  default     = 1024
}

variable "app_desired_count" {
  description = "How many app tasks to run."
  type        = number
  default     = 1
}

variable "source_zip" {
  description = "Path (relative to this module) to the source zip Terraform uploads for CodeBuild. Create it with `git archive` at the repo root."
  type        = string
  default     = "../../source.zip"
}

variable "enable_tick_scheduler" {
  description = "Run the once-a-minute backstop tick (EventBridge → ECS RunTask). The open console self-ticks; this keeps the beat when nobody's watching."
  type        = bool
  default     = true
}
