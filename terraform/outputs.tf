output "alb_dns" {
  value = aws_lb.app_alb.dns_name
}

output "alb_arn" {
  value = aws_lb.app_alb.arn
}

output "route53_record" {
  value = length(aws_route53_record.site_record) > 0 ? aws_route53_record.site_record[0].fqdn : ""
}

output "certificate_arn" {
  value = var.enable_cloudfront ? (length(aws_acm_certificate.cloudfront_cert) > 0 ? aws_acm_certificate.cloudfront_cert[0].arn : "") : (length(aws_acm_certificate.site_cert) > 0 ? aws_acm_certificate.site_cert[0].arn : "")
}

output "https_endpoint" {
  value = length(var.domain_name) > 0 && length(var.hosted_zone_id) > 0 ? "https://${var.domain_name}" : (var.enable_cloudfront ? "https://${aws_cloudfront_distribution.cdn[0].domain_name}" : "")
}
