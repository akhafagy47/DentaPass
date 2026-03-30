export default function Spinner({ size = '1em', color = 'currentColor' }) {
  return (
    <span
      className="dp-spinner"
      style={{ width: size, height: size, color }}
      aria-hidden="true"
    />
  );
}
