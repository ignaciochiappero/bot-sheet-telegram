data "archive_file" "lambda_artifact" {
  type        = "zip"
  source_file = "../dist/handler.js"
  output_path = "../dist/lambda.zip"
}

resource "aws_lambda_function" "telegram_bot" {
  filename         = data.archive_file.lambda_artifact.output_path
  function_name    = "telegram-bot-sheets"
  role            = aws_iam_role.lambda_exec.arn
  runtime         = "nodejs20.x"
  handler         = "handler.handler"
  source_code_hash = data.archive_file.lambda_artifact.output_base64sha256

  timeout     = 60
  memory_size = 512

  environment {
    variables = {
      TELEGRAM_BOT_TOKEN            = var.telegram_bot_token
      WEBHOOK_SECRET                = var.webhook_secret
      GROQ_API_KEY                  = var.groq_api_key
      GOOGLE_SERVICE_ACCOUNT_JSON     = file("google-credentials.json")
      SPREADSHEET_ID                = var.spreadsheet_id
    }
  }
}

resource "aws_api_gateway_rest_api" "telegram_bot_api" {
  name        = "telegram-bot-sheets"
  description = "API for Telegram bot webhook"
}

resource "aws_api_gateway_resource" "webhook" {
  rest_api_id = aws_api_gateway_rest_api.telegram_bot_api.id
  parent_id   = aws_api_gateway_rest_api.telegram_bot_api.root_resource_id
  path_part   = "webhook"
}

resource "aws_api_gateway_method" "webhook_post" {
  rest_api_id   = aws_api_gateway_rest_api.telegram_bot_api.id
  resource_id   = aws_api_gateway_resource.webhook.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda" {
  rest_api_id = aws_api_gateway_rest_api.telegram_bot_api.id
  resource_id = aws_api_gateway_resource.webhook.id
  http_method = aws_api_gateway_method.webhook_post.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.telegram_bot.invoke_arn
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.telegram_bot.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.telegram_bot_api.execution_arn}/*/*"
}

resource "aws_api_gateway_deployment" "telegram_bot_deploy" {
  depends_on = [aws_lambda_permission.api_gateway]

  rest_api_id = aws_api_gateway_rest_api.telegram_bot_api.id
  stage_name  = "prod"

  lifecycle {
    create_before_destroy = true
  }
}
