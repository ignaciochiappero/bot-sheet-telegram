output "api_endpoint" {
  description = "API Gateway endpoint for Telegram webhook"
  value       = aws_api_gateway_deployment.telegram_bot_deploy.invoke_url
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.telegram_bot.function_name
}
