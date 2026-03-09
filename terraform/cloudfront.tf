resource "aws_cloudfront_origin_access_identity" "oai" {
  comment = "OAI for ${var.environment}"
}

resource "aws_cloudfront_distribution" "cdn" {
  count = var.enable_cloudfront ? 1 : 0
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CDN for ${var.domain_name}"
  default_root_object = "index.html"

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
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "alb-origin"
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
    viewer_protocol_policy = "redirect-to-https"
    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.domain_name == "" ? true : false
    # If providing a custom certificate, user must create an ACM cert in us-east-1
    acm_certificate_arn = ""
    ssl_support_method  = "sni-only"
  }

  tags = { Name = "${var.environment}-cdn" }
}

output "cloudfront_domain" {
  value = var.enable_cloudfront ? aws_cloudfront_distribution.cdn[0].domain_name : ""
}
