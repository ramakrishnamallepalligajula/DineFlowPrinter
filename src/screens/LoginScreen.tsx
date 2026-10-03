import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { login } from "../api/auth";
import type {
  AuthUser,
  Restaurant,
} from "../types/auth";

interface LoginScreenProps {
  onLogin: (
    token: string,
    user: AuthUser,
    restaurant: Restaurant
  ) => void;
}

function LoginScreen({
  onLogin,
}: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const handleLogin = async () => {
    const normalizedEmail =
      email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      Alert.alert(
        "Missing Information",
        "Enter your email and password."
      );
      return;
    }

    try {
      setLoading(true);

      const data = await login(
        normalizedEmail,
        password
      );

      onLogin(
        data.token,
        data.user,
        data.restaurant
      );
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      Alert.alert(
        "Login Failed",
        error instanceof Error
          ? error.message
          : "Unable to login."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.logo}>
              DineFlow
            </Text>

            <Text style={styles.title}>
              Printer Login
            </Text>

            <Text style={styles.subtitle}>
              Sign in with your DineFlow
              restaurant account.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>
              Email
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#A3A3A3"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!loading}
            />

            <Text style={styles.label}>
              Password
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#A3A3A3"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />

            <TouchableOpacity
              style={[
                styles.loginButton,
                loading &&
                  styles.disabledButton,
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator
                  color="#FFFFFF"
                />
              ) : (
                <Text
                  style={styles.loginText}
                >
                  Sign In
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>
            DineFlow Printer
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F6F7F9",
  },

  keyboardView: {
    flex: 1,
  },

  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },

  header: {
    marginBottom: 28,
  },

  logo: {
    fontSize: 15,
    fontWeight: "800",
    color: "#F15A24",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
  },

  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#171717",
  },

  subtitle: {
    fontSize: 15,
    color: "#737373",
    lineHeight: 22,
    marginTop: 8,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#404040",
    marginBottom: 8,
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#D4D4D4",
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#171717",
    backgroundColor: "#FFFFFF",
    marginBottom: 18,
  },

  loginButton: {
    height: 52,
    borderRadius: 11,
    backgroundColor: "#171717",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  disabledButton: {
    opacity: 0.6,
  },

  loginText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  footer: {
    textAlign: "center",
    color: "#A3A3A3",
    fontSize: 12,
    marginTop: 24,
  },
});

export default LoginScreen;