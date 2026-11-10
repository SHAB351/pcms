import {
  BarChart3,
  CalendarDays,
  FileText,
  LayoutDashboard,
  ListChecks,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Résumé affiché dans l'infobulle et sur les pages vides. */
  description: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Pilotage",
    items: [
      {
        href: "/tableau-de-bord",
        label: "Tableau de bord",
        icon: LayoutDashboard,
        description: "Vue d'ensemble de l'activité du service.",
      },
      {
        href: "/calendrier",
        label: "Calendrier éditorial",
        icon: CalendarDays,
        description: "Planifier les prises de parole et les publications.",
      },
      {
        href: "/taches",
        label: "Tâches",
        icon: ListChecks,
        description: "Suivre les travaux en cours et les échéances.",
      },
      {
        href: "/rapports",
        label: "Rapports d'activité",
        icon: BarChart3,
        description: "Synthèses périodiques à partir du journal d'activité.",
      },
    ],
  },
  {
    title: "Contenus",
    items: [
      {
        href: "/documents",
        label: "Documents",
        icon: FileText,
        description: "Centraliser les documents internes du service.",
      },
      {
        href: "/assistant",
        label: "Assistant IA",
        icon: Sparkles,
        description: "Préparer des brouillons soumis à relecture humaine.",
      },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  href: "/parametres",
  label: "Paramètres",
  icon: Settings,
  description: "Compte, rôle et état de la configuration.",
};
