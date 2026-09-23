import { ArrowLeft, ChartNoAxesCombined, Baby, ShoppingBasket } from "lucide-react";
import type { ReactNode } from "react";
import type { PortalModule } from "../pages/PortalPage";

type Props = { module: Exclude<PortalModule, "kakeibo">; onPortal: () => void; children: ReactNode };

export function ModuleShell({ module, onPortal, children }: Props) {
  const isMeal = module === "meal";
  const Icon = isMeal ? ShoppingBasket : Baby;
  return <div className={`module-shell module-shell--${module}`}>
    <header className="module-header">
      <button type="button" className="module-back" onClick={onPortal}><ArrowLeft size={19} /> ポータル</button>
      <div className="module-title"><Icon size={22} /><strong>{isMeal ? "献立ノート" : "育児ノート"}</strong></div>
      <span className="module-brand"><ChartNoAxesCombined size={16} /> 暮らしのポータル</span>
    </header>
    <main className="module-main">{children}</main>
  </div>;
}
