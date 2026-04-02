resource "aws_security_group" "db_sg" {
  count       = var.enable_database ? 1 : 0
  name        = "${var.environment}-db-sg"
  description = "Allow database access from EC2"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "MySQL from app instances"
    from_port       = var.db_port
    to_port         = var.db_port
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.environment}-db-sg" }
}

resource "aws_db_subnet_group" "db" {
  count      = var.enable_database ? 1 : 0
  name       = "${var.environment}-db-subnets"
  subnet_ids = [for s in aws_subnet.private : s.id]

  tags = { Name = "${var.environment}-db-subnets" }
}

resource "aws_db_instance" "mysql" {
  count = var.enable_database ? 1 : 0

  identifier                  = "${var.environment}-mysql"
  engine                      = "mysql"
  engine_version              = "8.0"
  instance_class              = local.selected_db_instance_class
  allocated_storage           = local.selected_db_allocated_storage_gb
  storage_type                = "gp3"
  db_name                     = var.db_name
  username                    = var.db_username
  manage_master_user_password = true
  port                        = var.db_port

  vpc_security_group_ids = [aws_security_group.db_sg[0].id]
  db_subnet_group_name   = aws_db_subnet_group.db[0].name

  multi_az = var.db_multi_az

  publicly_accessible = false
  skip_final_snapshot = true
  deletion_protection = false

  tags = { Name = "${var.environment}-mysql" }
}
