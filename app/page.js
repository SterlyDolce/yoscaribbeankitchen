import RestaurantPage from "./RestaurantPage";
import { getMenuItems } from "./menu-data";
import { variant } from "./site-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  let menuItems = [];
  let menuError = null;

  try {
    menuItems = await getMenuItems();
  } catch (error) {
    console.error("Unable to load menu for home page.", error);
    menuError = "The live menu is temporarily unavailable.";
  }

  return <RestaurantPage menuError={menuError} menuItems={menuItems} variant={variant} />;
}
