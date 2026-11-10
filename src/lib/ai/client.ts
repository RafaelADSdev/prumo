export async function aiRequest<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch("/api/ai" + url, { cache: "no-store", ...init });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Error(
      result.error ||
        (response.status === 413
          ? "O arquivo excede o tamanho permitido."
          : "Não foi possível acessar o assistente. Tente novamente."),
    );
  }
  return result as T;
}

export function jsonRequest(method: string, data: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}
