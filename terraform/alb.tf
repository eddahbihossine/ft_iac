resource "aws_lb" "app_alb" {
  name               = length(var.alb_name) > 0 ? var.alb_name : "${var.environment}-alb-iac"
  internal           = false
  load_balancer_type = "application"
  subnets            = [for s in aws_subnet.public : s.id]
  security_groups    = [aws_security_group.alb_sg.id]
  tags               = { Name = "${var.environment}-alb" }
}

resource "aws_lb_target_group" "app_tg" {
  name     = length(var.target_group_name) > 0 ? var.target_group_name : "${var.environment}-tg-iac"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id
  health_check {
    path                = "/health/liveness"
    protocol            = "HTTP"
    port                = "3000"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

resource "aws_lb_listener" "http" {
  count             = length(var.domain_name) > 0 && length(var.hosted_zone_id) > 0 && !var.enable_cloudfront ? 0 : 1
  load_balancer_arn = aws_lb.app_alb.arn
  port              = "80"
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app_tg.arn
  }
}

resource "aws_lb_listener" "http_redirect" {
  count             = length(var.domain_name) > 0 && length(var.hosted_zone_id) > 0 && !var.enable_cloudfront ? 1 : 0
  load_balancer_arn = aws_lb.app_alb.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  count             = length(var.domain_name) > 0 && length(var.hosted_zone_id) > 0 && !var.enable_cloudfront ? 1 : 0
  load_balancer_arn = aws_lb.app_alb.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.cert_validation[0].certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app_tg.arn
  }
}

resource "aws_lb_target_group_attachment" "ec2_attach" {
  target_group_arn = aws_lb_target_group.app_tg.arn
  target_id        = aws_instance.example.id
  port             = 3000
}

output "app_url" {
  value = length(var.domain_name) > 0 && length(var.hosted_zone_id) > 0 ? "https://${var.domain_name}" : (var.enable_cloudfront ? "https://${aws_cloudfront_distribution.cdn[0].domain_name}" : "http://${aws_lb.app_alb.dns_name}")
}
