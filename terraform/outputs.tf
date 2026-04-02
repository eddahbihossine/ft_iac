output "alb_dns" {
  value = var.enable_alb ? aws_lb.app_alb[0].dns_name : ""
}

output "alb_arn" {
  value = var.enable_alb ? aws_lb.app_alb[0].arn : ""
}

output "target_group_arn" {
  value = var.enable_alb ? aws_lb_target_group.app_tg[0].arn : ""
}

output "asg_name" {
  value = var.enable_alb ? aws_autoscaling_group.app[0].name : ""
}

output "route53_record" {
  value = length(aws_route53_record.site_record) > 0 ? aws_route53_record.site_record[0].fqdn : ""
}

output "certificate_arn" {
  value = var.enable_cloudfront ? (length(aws_acm_certificate.cloudfront_cert) > 0 ? aws_acm_certificate.cloudfront_cert[0].arn : "") : (length(aws_acm_certificate.site_cert) > 0 ? aws_acm_certificate.site_cert[0].arn : "")
}

output "https_endpoint" {
  value = length(var.domain_name) > 0 && length(var.hosted_zone_id) > 0 ? "https://${var.domain_name}" : (length(aws_cloudfront_distribution.cdn) > 0 ? "https://${aws_cloudfront_distribution.cdn[0].domain_name}" : "")
}

output "app_endpoint" {
  value = length(var.domain_name) > 0 && length(var.hosted_zone_id) > 0 ? "https://${var.domain_name}" : (
    length(aws_cloudfront_distribution.cdn) > 0 ? "https://${aws_cloudfront_distribution.cdn[0].domain_name}" : (
      var.enable_alb ? "http://${aws_lb.app_alb[0].dns_name}" : "http://${aws_instance.example[0].public_ip}:${var.app_public_port}"
    )
  )
}

output "selected_region" {
  value = local.selected_region
}

output "selected_server_instance_type" {
  value = local.selected_server_instance_type
}

output "db_endpoint" {
  value = var.enable_database ? aws_db_instance.mysql[0].address : ""
}

output "db_master_secret_arn" {
  value     = var.enable_database ? aws_db_instance.mysql[0].master_user_secret[0].secret_arn : ""
  sensitive = true
}
