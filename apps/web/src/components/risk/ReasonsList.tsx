export function ReasonsList({ reasons }: { reasons: string[] }) {
  return (
    <ul className="reasons-list">
      {reasons.map((reason) => (
        <li key={reason}>{reason}</li>
      ))}
    </ul>
  );
}
