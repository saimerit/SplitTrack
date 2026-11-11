import { Landmark } from 'lucide-react';

/** The product mark is code-drawn so it stays crisp at every size. */
const SplitTrackLogo = ({ compact = false, className = '' }) => (
  <div className={`flex items-center gap-2.5 ${className}`}>
    <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/25">
      <Landmark size={19} strokeWidth={2.25} aria-hidden="true" />
    </div>
    {!compact && <span className="text-lg font-semibold tracking-tight text-foreground">split<span className="text-primary">track</span></span>}
  </div>
);

export default SplitTrackLogo;
