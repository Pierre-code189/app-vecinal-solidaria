import React from "react";
import { Tabs } from "expo-router";
import { TabBar } from "../../components/TabBar";
import { Header } from "../../components/Header";
import { useTema } from "../../context/ajustes";

export default function TabsLayout() {
  const { c } = useTema();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        header: () => <Header />,
        sceneStyle: { backgroundColor: c.bg },
        animation: "fade",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Local" }} />
      <Tabs.Screen name="favores" options={{ title: "Favores" }} />
      <Tabs.Screen name="emergencia" options={{ title: "Emergencia" }} />
      <Tabs.Screen name="perfil" options={{ title: "Perfil" }} />
    </Tabs>
  );
}
