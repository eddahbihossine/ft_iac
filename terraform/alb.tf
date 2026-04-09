resource "aws_lb" "app_alb" {
  count              = var.enable_alb ? 1 : 0
  name               = length(var.alb_name) > 0 ? var.alb_name : "${var.environment}-alb-iac"
  internal           = false
  load_balancer_type = "application"
  subnets            = [for s in aws_subnet.public : s.id]
  security_groups    = [aws_security_group.alb_sg[0].id]
  tags               = { Name = "${var.environment}-alb" }
}

resource "aws_lb_target_group" "app_tg" {
  count    = var.enable_alb ? 1 : 0
  name     = length(var.target_group_name) > 0 ? var.target_group_name : "${var.environment}-tg-iac"
  port     = var.app_public_port
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  stickiness {
    enabled         = true
    type            = "lb_cookie"
    cookie_duration = 3600
  }

  health_check {
    path                = var.app_health_path
    protocol            = "HTTP"
    port                = tostring(var.app_public_port)
    matcher             = "200"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

resource "aws_lb_listener" "http" {
  count             = var.enable_alb ? (length(var.domain_name) > 0 && length(var.hosted_zone_id) > 0 && !var.enable_cloudfront ? 0 : 1) : 0
  load_balancer_arn = aws_lb.app_alb[0].arn
  port              = "80"
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app_tg[0].arn
  }
}

resource "aws_lb_listener" "http_redirect" {
  count             = var.enable_alb ? (length(var.domain_name) > 0 && length(var.hosted_zone_id) > 0 && !var.enable_cloudfront ? 1 : 0) : 0
  load_balancer_arn = aws_lb.app_alb[0].arn
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
  count             = var.enable_alb ? (length(var.domain_name) > 0 && length(var.hosted_zone_id) > 0 && !var.enable_cloudfront ? 1 : 0) : 0
  load_balancer_arn = aws_lb.app_alb[0].arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.cert_validation[0].certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app_tg[0].arn
  }
}
