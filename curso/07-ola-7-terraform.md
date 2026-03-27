# OLA 7: Terraform - La Infraestructura

## La pregunta de esta ola

¿Cómo creamos todo el entorno de AWS (Lambda, API Gateway, roles) de forma automatizada y reproducible?

---

## El problema

Si quisiéramos crear todo a mano en AWS:

1. Crear función Lambda
2. Configurar runtime, memoria, timeout
3. Crear API Gateway
4. Configurar route /webhook
5. Crear IAM role con permisos
6. Adjuntar el role a Lambda
7. Subir el código .zip
8. Configurar variables de entorno
9. ...y un largo etc.

**Problemas de hacer a mano:**
- No es reproducible
- Si borrás, no sabés cómo recrear
- Difícil de versionar
- Errores humanos

---

## ¿Qué es Terraform?

**Infrastructure as Code (IaC)**: definís tu infraestructura en archivos de configuración, y Terraform la crea automáticamente.

```hcl
# terraform/lambda.tf
resource "aws_lambda_function" "telegram_bot" {
  function_name = "telegram-bot-sheets"
  runtime       = "nodejs20.x"
  handler       = "handler.handler"
  memory_size   = 512
  timeout       = 60
}
```

Ejecutás `terraform apply` y magia.

---

## Los archivos de Terraform

```
terraform/
├── main.tf          # Provider AWS
├── lambda.tf        # Lambda + API Gateway
├── iam.tf           # Permisos (IAM role)
├── variables.tf     # Definición de variables
├── terraform.tfvars # Valores reales (gitignored)
├── outputs.tf       # Resultados (URL del endpoint)
└── README.md        # Instrucciones
```

---

## Lambda + API Gateway

```hcl
# terraform/lambda.tf
resource "aws_lambda_function" "telegram_bot" {
  filename         = "dist/lambda.zip"
  function_name    = "telegram-bot-sheets"
  source_code_hash = filebase64sha256("dist/lambda.zip")
  
  runtime       = "nodejs20.x"
  handler       = "handler.handler"
  memory_size   = 512
  timeout       = 60

  environment {
    variables = {
      TELEGRAM_BOT_TOKEN = var.telegram_bot_token
      GROQ_API_KEY      = var.groq_api_key
      # ...
    }
  }
}

resource "aws_api_gateway_rest_api" "telegram" {
  name = "telegram-bot-api"
}

resource "aws_api_gateway_resource" "webhook" {
  rest_api_id = aws_api_gateway_rest_api.telegram.id
  parent_id   = aws_api_gateway_rest_api.telegram.root_resource_id
  path_part   = "webhook"
}

resource "aws_api_gateway_method" "webhook_post" {
  rest_api_id   = aws_api_gateway_rest_api.telegram.id
  resource_id   = aws_api_gateway_resource.webhook.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda" {
  rest_api_id = aws_api_gateway_rest_api.telegram.id
  resource_id = aws_api_gateway_resource.webhook.id
  http_method = aws_api_gateway_method.webhook_post.http_method
  
  integration_http_method = "POST"
  type                    = "AWS_PROXY"  # Lambda Proxy Integration
  uri                     = aws_lambda_function.telegram_bot.invoke_arn
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.telegram_bot.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.telegram.execution_arn}/*/*"
}
```

Mucho código, pero todo declarativo.

---

## IAM (permisos)

```hcl
# terraform/iam.tf
resource "aws_iam_role" "lambda_role" {
  name = "telegram-bot-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}
```

AWSLambdaBasicExecutionRole permite escribir logs en CloudWatch.

---

## Variables

```hcl
# terraform/variables.tf
variable "telegram_bot_token" {
  description = "Token del bot de Telegram"
  type        = string
  sensitive   = true
}

variable "groq_api_key" {
  description = "API key de Groq"
  type        = string
  sensitive   = true
}
```

Los valores reales van en `terraform.tfvars` (que está en .gitignore):

```hcl
# terraform/terraform.tfvars
telegram_bot_token = "8502029031:AAH..."
groq_api_key      = "gsk_..."
spreadsheet_id    = "1vp3oF__..."
```

---

## Credenciales de Google

Las credenciales del Service Account se pasan como variable de entorno, pero como el JSON es largo, usamos `file()`:

```hcl
environment {
  variables = {
    GOOGLE_SERVICE_ACCOUNT_JSON = file("google-credentials.json")
  }
}
```

---

## El flujo de deploy

```bash
# 1. Build del código
pnpm build

# 2. Zip
powershell -Command "Compress-Archive -Path dist/handler.js -DestinationPath dist/lambda.zip -Force"

# 3. Actualizar Lambda
aws lambda update-function-code --function-name telegram-bot-sheets --zip-file fileb://dist/lambda.zip
```

No necesitamos recrear toda la infra con Terraform cada vez — solo actualizamos el código.

---

## La idea clave de esta ola

> **Terraform define nuestra infraestructura como código. Un solo `terraform apply` crea Lambda, API Gateway, IAM roles, y todo lo necesario. Después, solo actualizamos el código con `aws lambda update-function-code`.**

---

## Resumen de las 8 olas

| Ola | Tema | Pieza clave |
|-----|------|-------------|
| 1 | Panorama General | Las 4 partes del sistema |
| 2 | Telegram + Webhooks | Cómo llega el mensaje |
| 2B | API Gateway | El portero hacia Lambda |
| 3 | AWS Lambda | El compute serverless |
| 4 | grammY | El framework del bot |
| 5 | Groq AI | La inteligencia |
| 6 | Google Sheets | La base de datos |
| 7 | Terraform | La infraestructura |

---

## Próximos pasos

Si querés profundizar:

- Crear tests unitarios
- Agregar más comandos (/ventas, /ayuda)
- Manejar errores específicos (no solo genérico)
- Agregar analytics (qué se vende más)
- Notifications cuando hay venta
- Docker para desarrollo local
