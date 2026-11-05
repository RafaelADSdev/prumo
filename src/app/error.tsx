"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth">
      <h1>Não foi possível abrir o financeiro</h1>
      <button onClick={reset}>Tentar novamente</button>
    </main>
  );
}
