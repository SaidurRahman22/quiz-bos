export default function Loader({ label = 'Loading…' }) {
  return (
    <div className="spinner-wrap">
      <div className="text-center">
        <div className="qb-spinner mx-auto mb-3" />
        <div className="text-muted-2">{label}</div>
      </div>
    </div>
  );
}
