.PHONY: help build up down restart logs logs-api logs-db logs-adminer clean rebuild shell-api shell-db ps health install test lint format

# Default target
help: ## Show this help message
	@echo "Usage: make [target]"
	@echo ""
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Docker Operations
build: ## Build all containers
	docker compose build

up: ## Start all services in detached mode
	docker compose up -d

down: ## Stop and remove all containers
	docker compose down

restart: ## Restart all services
	docker compose restart

stop: ## Stop all services without removing
	docker compose stop

start: ## Start existing containers
	docker compose start

rebuild: ## Rebuild and restart all services
	docker compose down
	docker compose up  --build -d

clean: ## Stop containers and remove volumes
	docker compose down -v

prune: ## Clean up unused Docker resources
	docker system prune -f

# Logs
logs: ## Follow logs from all services
	docker compose logs -f

logs-api: ## Follow logs from API service
	docker compose logs -f api

logs-db: ## Follow logs from database service
	docker compose logs -f db

logs-adminer: ## Follow logs from Adminer service
	docker compose logs -f adminer

# Shell Access
shell-api: ## Open shell in API container
	docker compose exec api sh

shell-db: ## Open MySQL shell in database container
	docker compose exec db mysql -u root -p

# Status
ps: ## Show status of all containers
	docker compose ps

	@echo "=== Container Status ==="
	@docker compose ps
	@echo ""
	@echo "=== API Health ==="
	@curl -s http://localhost:3000/health/liveness || echo "API not responding"
	@echo ""

# Development
install: ## Install dependencies locally
	pnpm install

dev: ## Run development server locally
	pnpm run start:dev

test: ## Run tests
	pnpm test

test-e2e: ## Run e2e tests
	pnpm run test:e2e

lint: ## Lint code
	pnpm run lint

format: ## Format code
	pnpm run format

# Database Operations
	docker compose down -v
	docker compose up -d db
	@echo "Waiting for database to be ready..."
	@sleep 10
	docker compose up -d

db-backup: ## Backup database to file
	docker compose exec db mysqladmin -u root -padmin processlist
	docker compose exec db mysqldump -u root -padmin todo_app > backup_$(shell date +%Y%m%d_%H%M%S).sql

# Production

prod-up: ## Start services in production mode
	docker compose up -d --build --force-recreate


prod-logs: ## View production logs (last 100 lines)
	docker compose logs --tail=100

# Quick Commands
quick-start: build up logs-api ## Build, start, and show API logs

quick-restart: down up logs-api ## Stop, start, and show API logs

full-reset: clean rebuild health ## Full cleanup and rebuild with health check
