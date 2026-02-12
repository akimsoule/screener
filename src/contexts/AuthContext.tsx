import { createContext, useContext, useState, useEffect, useMemo } from "react";
import type { ReactNode } from "react";

interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Charger token et user depuis localStorage au démarrage
  useEffect(() => {
    const savedToken = localStorage.getItem("auth-token");
    const savedUser = localStorage.getItem("auth-user");

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error("Failed to parse saved user:", error);
        localStorage.removeItem("auth-token");
        localStorage.removeItem("auth-user");
      }
    }

    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Login failed" }));
      throw new Error(error.message || "Invalid credentials");
    }

    const { user: newUser, token: newToken } = await res.json();

    setUser(newUser);
    setToken(newToken);
    localStorage.setItem("auth-token", newToken);
    localStorage.setItem("auth-user", JSON.stringify(newUser));
  };

  const signup = async (email: string, password: string, name?: string) => {
    const res = await fetch("/api/auth-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    if (!res.ok) {
      const error = await res
        .json()
        .catch(() => ({ message: "Signup failed" }));
      throw new Error(error.message || "Registration failed");
    }

    const { user: newUser, token: newToken } = await res.json();

    setUser(newUser);
    setToken(newToken);
    localStorage.setItem("auth-token", newToken);
    localStorage.setItem("auth-user", JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("auth-token");
    localStorage.removeItem("auth-user");
  };

  const contextValue = useMemo(
    () => ({
      user,
      token,
      login,
      signup,
      logout,
      isAuthenticated: !!user,
      isLoading,
    }),
    [user, token, login, signup, logout, isLoading],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
