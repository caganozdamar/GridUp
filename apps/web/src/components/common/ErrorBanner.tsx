export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="error-banner" role="alert">
      <span className="error-banner-icon">⚠</span>
      <span>{message}</span>
    </div>
  );
}
