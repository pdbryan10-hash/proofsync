# HTTPS on the ALB via an ACM certificate for a custom subdomain.
#
# Set `domain_name` (e.g. aws-demo.proofsync.co.uk) to enable it. Everything here
# is count-gated on that, so leaving it empty keeps the stack HTTP-only.
#
# Two-step because ACM uses DNS validation:
#   1) apply -target=aws_acm_certificate.cert   -> prints the validation record
#   2) add that record at your DNS host, then a full `apply` finishes the cert +
#      creates the :443 listener. Finally point your subdomain (CNAME) at the ALB.

variable "domain_name" {
  description = "Custom subdomain for HTTPS (e.g. aws-demo.proofsync.co.uk). Empty = HTTP only."
  type        = string
  default     = ""
}

resource "aws_acm_certificate" "cert" {
  count             = var.domain_name == "" ? 0 : 1
  domain_name       = var.domain_name
  validation_method = "DNS"
  lifecycle {
    create_before_destroy = true
  }
}

# Waits until the DNS validation record you added has been picked up by ACM.
resource "aws_acm_certificate_validation" "cert" {
  count           = var.domain_name == "" ? 0 : 1
  certificate_arn = aws_acm_certificate.cert[0].arn
}

resource "aws_lb_listener" "https" {
  count             = var.domain_name == "" ? 0 : 1
  load_balancer_arn = aws_lb.app.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.cert[0].certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

output "acm_validation_record" {
  description = "Add this CNAME at your DNS host to validate the certificate."
  value = var.domain_name == "" ? null : {
    name  = tolist(aws_acm_certificate.cert[0].domain_validation_options)[0].resource_record_name
    type  = tolist(aws_acm_certificate.cert[0].domain_validation_options)[0].resource_record_type
    value = tolist(aws_acm_certificate.cert[0].domain_validation_options)[0].resource_record_value
  }
}

output "app_cname_target" {
  description = "Point your subdomain (CNAME) at this once the cert is issued."
  value       = var.domain_name == "" ? null : aws_lb.app.dns_name
}
