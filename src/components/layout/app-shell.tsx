"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { deconnexion } from "@/lib/actions/auth";
import { getRouteTitle } from "@/lib/auth/routes";
import { ROLE_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";
import { NAV_SECTIONS, SETTINGS_ITEM, type NavItem } from "./navigation";

function initials(profile: Profile): string {
  const source = profile.full_name?.trim() || profile.email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={item.description}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-slate-900 text-white"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function SidebarContent({
  pathname,
  profile,
  onNavigate,
}: {
  pathname: string;
  profile: Profile;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
          PC
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">PCMS</p>
          <p className="truncate text-xs text-slate-500">Communication politique</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {section.title}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <NavLink
          item={SETTINGS_ITEM}
          active={pathname.startsWith(SETTINGS_ITEM.href)}
          onNavigate={onNavigate}
        />
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
            {initials(profile)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">
              {profile.full_name?.trim() || profile.email}
            </p>
            <p className="truncate text-xs text-slate-500">{ROLE_LABELS[profile.role]}</p>
          </div>
          <form action={deconnexion}>
            <button
              type="submit"
              title="Se déconnecter"
              aria-label="Se déconnecter"
              className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/**
 * Coquille de l'application : barre latérale fixe à partir de 1024 px,
 * tiroir coulissant en dessous. Le contenu (`children`) reste rendu côté
 * serveur ; il traverse seulement ce composant client.
 */
export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const title = getRouteTitle(pathname);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* En-tête mobile */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Ouvrir le menu"
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="text-sm font-semibold text-slate-900">{title}</span>
      </header>

      {/* Tiroir mobile */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 h-full w-full bg-slate-900/40"
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-white shadow-xl">
            <div className="absolute right-2 top-3 z-10">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Fermer le menu"
                className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <SidebarContent
              pathname={pathname}
              profile={profile}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      ) : null}

      {/* Barre latérale fixe */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <SidebarContent pathname={pathname} profile={profile} />
      </aside>

      <div className="lg:pl-64">
        <header className="hidden h-16 items-center justify-between border-b border-slate-200 bg-white px-8 lg:flex">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">
            Plateforme interne — contenu réservé au service
          </p>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
