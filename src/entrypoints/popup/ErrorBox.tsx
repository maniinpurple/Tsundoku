export function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="card error-box">
      <p>{message}</p>
      <button onClick={onRetry}>Try again</button>
    </section>
  );
}
