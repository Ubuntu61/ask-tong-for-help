import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { ClipboardList, LayoutGrid, ListChecks, PackageCheck, PlusSquare, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof PlusSquare; exact?: boolean };
const NAV: NavItem[] = [
  { to: "/", label: "下单", icon: PlusSquare, exact: true },
  { to: "/orders", label: "订单", icon: ClipboardList },
  { to: "/dispatch", label: "排班", icon: LayoutGrid },
  { to: "/bins", label: "桶库存", icon: PackageCheck },
  { to: "/fleet", label: "车队", icon: Truck },
];

export function StaffLayout() {
  const location = useLocation();
  const path = location.pathname;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="w-56 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="text-lg font-bold tracking-wide">Kennedy Depot</div>
          <div className="text-xs text-sidebar-foreground/60 mt-0.5">调度运营系统</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => {
            const active = item.exact ? path === item.to : path.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <Link
            to="/driver"
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground transition-colors"
          >
            <ListChecks className="h-4 w-4" />
            司机端入口
          </Link>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
