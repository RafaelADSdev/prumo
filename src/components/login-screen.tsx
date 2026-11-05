"use client";
import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  LoaderCircle,
  CircleAlert,
} from "lucide-react";
import { Brand } from "./brand";

export function LoginScreen({
  busy,
  error,
  needsSetup,
  onLogin,
}: {
  busy: boolean;
  error: string;
  needsSetup: boolean;
  onLogin: (email: string, password: string) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <main className="access-page">
      <div className="access-backdrop" aria-hidden="true">
        <svg
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
        >
          <path
            className="access-line access-line-one"
            d="M-80 752H232Q288 752 288 696V212Q288 156 344 156H1096Q1152 156 1152 100V-60"
          />
          <path
            className="access-line access-line-two"
            d="M-60 820H300Q356 820 356 764V280Q356 224 412 224H1164Q1220 224 1220 168V-60"
          />
          <path
            className="access-line access-line-three"
            d="M1490 776H1160Q1104 776 1104 720V676Q1104 620 1048 620H392Q336 620 336 564V-60"
          />
        </svg>
      </div>
      <div className="access-stage">
        <div className="access-brand">
          <Brand />
        </div>
        <section className="access-panel" aria-labelledby="access-title">
          <header className="access-heading">
            <h1 id="access-title">Acesse seu financeiro</h1>
            <p>Use seu e-mail e senha para continuar.</p>
          </header>
          <form
            aria-label="Acesso ao financeiro"
            aria-busy={busy}
            onSubmit={(e) => {
              e.preventDefault();
              if (busy) return;
              const fields = new FormData(e.currentTarget);
              onLogin(
                String(fields.get("email") || ""),
                String(fields.get("password") || ""),
              );
            }}
          >
            <label className="access-field">
              <span>E-mail</span>
              <span className="access-input">
                <Mail size={18} aria-hidden="true" />
                <input
                  aria-label="E-mail"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  disabled={busy}
                />
              </span>
            </label>
            <label className="access-field">
              <span>Senha</span>
              <span className="access-input">
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  aria-label="Senha"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  required
                  disabled={busy}
                />
                <button
                  type="button"
                  className="access-password"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={showPassword}
                  disabled={busy}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            {error && (
              <div role="alert" className="access-error">
                <CircleAlert size={18} aria-hidden="true" />
                <p>{error}</p>
              </div>
            )}
            <button className="access-submit" type="submit" disabled={busy}>
              <span>{busy ? "Entrando…" : "Entrar no financeiro"}</span>
              {busy ? (
                <LoaderCircle size={19} className="spin" aria-hidden="true" />
              ) : (
                <ArrowRight size={19} aria-hidden="true" />
              )}
            </button>
          </form>
          <p className="access-security">
            <ShieldCheck size={16} aria-hidden="true" /> Acesso individual e
            protegido
          </p>
          {needsSetup && (
            <p className="access-setup">
              Primeiro acesso? Crie o administrador no terminal com{" "}
              <code>npm run admin</code>.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
