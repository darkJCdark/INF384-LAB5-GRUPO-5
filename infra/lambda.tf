resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${var.proyecto}-api-${var.ambiente}"
  retention_in_days = 7
}

resource "aws_lambda_function" "api" {
  function_name = "${var.proyecto}-api-${var.ambiente}"
  role          = aws_iam_role.api.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.api.repository_url}:${var.version_imagen}"
  timeout       = 10
  memory_size   = 256

  environment {
    variables = {
      BUCKET_COMPROBANTES = aws_s3_bucket.comprobantes.bucket
    }
  }

  lifecycle {
    ignore_changes = [image_uri]
  }

  depends_on = [aws_cloudwatch_log_group.api]
}

resource "aws_lambda_function_url" "api" {
  #checkov:skip=CKV_AWS_258:Excepcion Decision 3 (DECISIONES.md). La app movil consume la URL sin credenciales de AWS; AWS_IAM la dejaria sin servicio.
  # EXCEPCION - cuatro datos:
  #   Responsable:            Lider tecnico
  #   Vencimiento:            12/12/2026
  #   Control compensatorio:  autenticacion de usuarios en el servicio externo al repositorio (a confirmar) y monitoreo de invocaciones.
  #   Riesgo aceptado:        cualquier persona con la URL puede invocar los endpoints de la API sin autenticacion de AWS.
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "NONE"
}
