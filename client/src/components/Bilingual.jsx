// Renders a bilingual value stored as "English\nBangla" as an English part,
// a very thin white divider, then the Bangla part. If the text has no newline
// (not yet bilingual), it renders unchanged.
export default function Bilingual({ text }) {
  if (text == null) return null;
  const str = String(text);
  const nl = str.indexOf('\n');
  if (nl === -1) return <>{str}</>;
  const en = str.slice(0, nl).trim();
  const bn = str.slice(nl + 1).trim();
  return (
    <>
      <span className="bi-en">{en}</span>
      <span className="bi-divider" aria-hidden="true" />
      <span className="bi-bn">{bn}</span>
    </>
  );
}
