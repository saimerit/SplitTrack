/** A lightweight, CSS-only ReactBits-style animated background. */
const GridGlow = ({ className = '' }) => (
  <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
    <div className="reactbits-grid" />
    <div className="reactbits-orb reactbits-orb-one" />
    <div className="reactbits-orb reactbits-orb-two" />
  </div>
);

export default GridGlow;
