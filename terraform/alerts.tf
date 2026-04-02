resource "aws_sns_topic" "alerts" {
  count = length(trimspace(var.alert_email)) > 0 && var.enable_alb ? 1 : 0
  name  = "${var.environment}-alerts"
}

resource "aws_sns_topic_subscription" "alerts_email" {
  count     = length(trimspace(var.alert_email)) > 0 && var.enable_alb ? 1 : 0
  topic_arn = aws_sns_topic.alerts[0].arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_cloudwatch_metric_alarm" "alb_target_5xx" {
  count = length(trimspace(var.alert_email)) > 0 && var.enable_alb ? 1 : 0

  alarm_name          = "${var.environment}-alb-target-5xx"
  alarm_description   = "ALB target 5XX responses detected"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  threshold           = var.alert_target_5xx_threshold
  period              = var.alert_period_seconds
  statistic           = "Sum"

  namespace   = "AWS/ApplicationELB"
  metric_name = "HTTPCode_Target_5XX_Count"

  dimensions = {
    LoadBalancer = aws_lb.app_alb[0].arn_suffix
    TargetGroup  = aws_lb_target_group.app_tg[0].arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts[0].arn]
  ok_actions    = [aws_sns_topic.alerts[0].arn]
}

resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_hosts" {
  count = length(trimspace(var.alert_email)) > 0 && var.enable_alb ? 1 : 0

  alarm_name          = "${var.environment}-alb-unhealthy-hosts"
  alarm_description   = "Unhealthy targets detected behind the ALB"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  threshold           = 1
  period              = 60
  statistic           = "Maximum"

  namespace   = "AWS/ApplicationELB"
  metric_name = "UnHealthyHostCount"

  dimensions = {
    LoadBalancer = aws_lb.app_alb[0].arn_suffix
    TargetGroup  = aws_lb_target_group.app_tg[0].arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts[0].arn]
  ok_actions    = [aws_sns_topic.alerts[0].arn]
}
