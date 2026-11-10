import { redirect } from "next/navigation";
import { HOME_PATH } from "@/lib/auth/routes";

/**
 * La racine n'affiche rien : elle renvoie vers le tableau de bord. Si la
 * session manque, le proxy redirige ensuite vers la page de connexion.
 */
export default function RootPage() {
  redirect(HOME_PATH);
}
