import { Stack } from "expo-router";
import { useTheme } from "@/context/ThemeContext";
import { Colors } from "@/constants/theme";

export default function AuthLayout() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen
        name="sign-in"
        options={{
          title: "Sign In",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="sign-up"
        options={{
          title: "Sign Up",
          headerShown: false,
        }}
      />
    </Stack>
  );
}
