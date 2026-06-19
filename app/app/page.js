import AppLanding from "../AppLanding";
import { getMenuItems } from "../menu-data";

export const metadata = {
  title: "Yo's App Home",
  description: "Quick order home screen for Yo's Caribbean Kitchen."
};

export const dynamic = "force-dynamic";

export default async function AppHomePage() {
  const menuItems = await getMenuItems();

  return <AppLanding menuItems={menuItems} />;
}
