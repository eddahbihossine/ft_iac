resource "aws_acm_certificate" "site_cert" {
  count             = length(var.domain_name) > 0 && length(var.hosted_zone_id) > 0 ? 1 : 0
  domain_name       = var.domain_name
  validation_method = "DNS"
  lifecycle {
    create_before_destroy = true
  }
  tags = { Name = "${var.environment}-cert" }
}

resource "aws_route53_record" "cert_validation" {
  count   = aws_acm_certificate.site_cert.*.domain_validation_options == [] ? 0 : length(aws_acm_certificate.site_cert[0].domain_validation_options)
  zone_id = var.hosted_zone_id
  name    = aws_acm_certificate.site_cert[0].domain_validation_options[count.index].resource_record_name
  type    = aws_acm_certificate.site_cert[0].domain_validation_options[count.index].resource_record_type
  records = [aws_acm_certificate.site_cert[0].domain_validation_options[count.index].resource_record_value]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "cert_validation" {
  count                   = length(aws_acm_certificate.site_cert) > 0 ? 1 : 0
  certificate_arn         = aws_acm_certificate.site_cert[0].arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

resource "aws_route53_record" "site_record" {
  count   = length(var.domain_name) > 0 && length(var.hosted_zone_id) > 0 ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "A"
  alias {
    name                   = aws_lb.app_alb.dns_name
    zone_id                = aws_lb.app_alb.zone_id
    evaluate_target_health = true
  }
}
