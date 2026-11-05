export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? "prumo-brand compact" : "prumo-brand"}>
      <span className="prumo-symbol">
        <svg viewBox="0 0 40 44" fill="none" aria-hidden="true">
          <path
            fill="currentColor"
            fillRule="evenodd"
            d="M9 5h13c8 0 13 5 13 12s-5 12-13 12h-6v10H9V5Zm7 7v10h6c4 0 6-2 6-5s-2-5-6-5h-6Z"
            clipRule="evenodd"
          />
          <path d="m23 33 5-4 5 4-5 7-5-7Z" fill="currentColor" />
        </svg>
      </span>
      <span className="prumo-wordmark">
        prumo<span className="prumo-period">.</span>
      </span>
    </span>
  );
}
