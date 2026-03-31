resource "aws_acm_certificate" "cloudfront_cert" {
  provider          = aws.us_east_1
  count             = var.enable_cloudfront && length(var.domain_name) > 0 && length(var.hosted_zone_id) > 0 ? 1 : 0
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "${var.environment}-cloudfront-cert" }
}

resource "aws_route53_record" "cloudfront_cert_validation" {
  count   = length(aws_acm_certificate.cloudfront_cert) > 0 ? length(aws_acm_certificate.cloudfront_cert[0].domain_validation_options) : 0
  zone_id = var.hosted_zone_id
  name    = aws_acm_certificate.cloudfront_cert[0].domain_validation_options[count.index].resource_record_name
  type    = aws_acm_certificate.cloudfront_cert[0].domain_validation_options[count.index].resource_record_type
  records = [aws_acm_certificate.cloudfront_cert[0].domain_validation_options[count.index].resource_record_value]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "cloudfront_cert_validation" {
  provider                = aws.us_east_1
  count                   = length(aws_acm_certificate.cloudfront_cert) > 0 ? 1 : 0
  certificate_arn         = aws_acm_certificate.cloudfront_cert[0].arn
  validation_record_fqdns = [for r in aws_route53_record.cloudfront_cert_validation : r.fqdn]
}

resource "aws_cloudfront_distribution" "cdn" {
  count           = var.enable_cloudfront ? 1 : 0
  enabled         = true
  is_ipv6_enabled = true
  comment         = "CDN for ${var.domain_name}"

  aliases = length(var.domain_name) > 0 ? [var.domain_name] : []

  origin {
    domain_name = aws_lb.app_alb.dns_name
    origin_id   = "alb-origin"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "alb-origin"
    forwarded_values {
      query_string = true
      headers      = ["*"]
      cookies {
        forward = "all"
      }
    }
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = length(var.domain_name) == 0 || length(var.hosted_zone_id) == 0
    acm_certificate_arn            = length(aws_acm_certificate_validation.cloudfront_cert_validation) > 0 ? aws_acm_certificate_validation.cloudfront_cert_validation[0].certificate_arn : null
    ssl_support_method             = length(var.domain_name) > 0 && length(var.hosted_zone_id) > 0 ? "sni-only" : null
    minimum_protocol_version       = length(var.domain_name) > 0 && length(var.hosted_zone_id) > 0 ? "TLSv1.2_2021" : null
  }

  tags = { Name = "${var.environment}-cdn" }
}

output "cloudfront_domain" {
  value = var.enable_cloudfront ? aws_cloudfront_distribution.cdn[0].domain_name : ""
}
