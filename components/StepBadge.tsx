interface Props {
  step: number;
  label: string;
  active?: boolean;
  done?: boolean;
}

export default function StepBadge({ step, label, active, done }: Props) {
  return (
    <div className={`flex items-center gap-2 transition-all duration-300 ${active ? "opacity-100" : "opacity-30"}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300 ${
        done
          ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/30"
          : active
          ? "bg-white/8 border-2 border-violet-500/70 text-violet-300"
          : "bg-white/4 border border-white/10 text-white/30"
      }`}>
        {done ? "✓" : step}
      </div>
      <span className={`text-xs font-medium transition-colors ${done ? "text-violet-300" : active ? "text-white/70" : "text-white/30"}`}>
        {label}
      </span>
    </div>
  );
}
