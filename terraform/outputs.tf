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
  value = length(aws_acm_certificate.site_cert) > 0 ? aws_acm_certificate.site_cert[0].arn : ""
}
