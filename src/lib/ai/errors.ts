import { ZodError } from "zod";

export class AiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export function aiJson(data: unknown) {
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}

export function aiFailure(error: unknown) {
  let message =
    "Não foi possível concluir a operação do assistente. Tente novamente.";
  let status = 500;
  if (error instanceof AiError) {
    ({ message, status } = error);
  } else if (error instanceof ZodError || error instanceof SyntaxError) {
    message = "Revise os dados enviados e tente novamente.";
    status = 400;
  } else if (error instanceof Error && error.message === "Não autenticado") {
    ({ message } = error);
    status = 401;
  } else if (error instanceof Error && error.message === "Origem inválida") {
    ({ message } = error);
    status = 403;
  } else if (hasCode(error, "P2021") || hasCode(error, "P2022")) {
    message = "O banco do Prumo precisa da atualização do Assistente IA.";
    status = 503;
  }
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function hasCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}
