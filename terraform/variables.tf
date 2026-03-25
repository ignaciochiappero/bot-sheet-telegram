variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "telegram_bot_token" {
  description = "Telegram bot token"
  type        = string
  sensitive   = true
}

variable "webhook_secret" {
  description = "Secret for webhook verification"
  type        = string
  sensitive   = true
}

variable "groq_api_key" {
  description = "Groq API key"
  type        = string
  sensitive   = true
}

variable "spreadsheet_id" {
  description = "Google Sheets ID (same spreadsheet for Stock and Sales)"
  type        = string
}
