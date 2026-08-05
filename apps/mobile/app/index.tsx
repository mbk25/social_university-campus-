import { Redirect } from "expo-router";

export default function Index() {
  // RouteGuard oturum durumuna göre yönlendirir; buraya sadece ilk açılışta düşülür.
  return <Redirect href="/(tabs)" />;
}
