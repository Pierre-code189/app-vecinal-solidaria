import React, { useEffect, useState } from "react";
import { Text, View, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Network from "expo-network";
import { AjustesProvider, useTema } from "../context/ajustes";
import { AuthProvider, useAuth } from "../context/auth";
import { ZonaProvider } from "../context/zona";
import { TourProvider } from "../context/tour";
import { ToastProvider } from "../components/ui";
import { ChatFab } from "../components/ChatFab";
import { sincronizarCola } from "../lib/api";
import { F } from "../lib/theme";

const qc = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 20000, refetchOnWindowFocus: false },
  },
});

function AvisoSinConexion() {
  const [offline, setOffline] = useState(false);
  const { c, escala } = useTema();

  useEffect(() => {
    let vivo = true;
    const revisar = async () => {
      try {
        const red = await Network.getNetworkStateAsync();
        const sin = red.isConnected === false || red.isInternetReachable === false;
        if (!vivo) return;
        setOffline(sin);
        if (!sin) sincronizarCola().catch(() => {});
      } catch {
        /* si no podemos saberlo, no mostramos nada */
      }
    };
    revisar();
    const t = setInterval(revisar, 20000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  if (!offline) return null;
  return (
    <View style={{ backgroundColor: c.info50, paddingVertical: 6, paddingHorizontal: 12 }}>
      <Text style={{ color: c.info, fontSize: 12 * escala, textAlign: "center" }}>
        Sin conexión. Lo que publiques se enviará al volver.
      </Text>
    </View>
  );
}

function Navegacion() {
  const { c } = useTema();
  const { cargando } = useAuth();

  if (cargando) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg }}>
        <ActivityIndicator color={c.brand600} size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <AvisoSinConexion />
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: c.bg },
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="publicacion/[id]" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="publicar" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="auth" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="chat/[contexto]/[ref]" />
          <Stack.Screen name="actividad" />
          <Stack.Screen name="moderacion" />
          <Stack.Screen name="tutorial" />
          <Stack.Screen name="recuperar" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        </Stack>
        <ChatFab />
      </View>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AjustesProvider>
          <QueryClientProvider client={qc}>
            <AuthProvider>
              <ZonaProvider>
                <ToastProvider>
                  <TourProvider>
                    <Navegacion />
                  </TourProvider>
                </ToastProvider>
              </ZonaProvider>
            </AuthProvider>
          </QueryClientProvider>
        </AjustesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
