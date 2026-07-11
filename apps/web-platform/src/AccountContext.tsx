import { createContext, useContext, useState, type ReactNode } from "react";
import { useAuth } from "./auth/AuthContext";

/** Demo consumer identities standing in for real citizen login/SSO. */
export const DEMO_ACCOUNTS = [
  { accountNumber: "WE-2024-00421", name: "Thandi Cele" },
  { accountNumber: "WE-2024-00887", name: "W. Engelbrecht" },
  { accountNumber: "TSH-2025-00012", name: "Naledi Mokoena" },
  { accountNumber: "ETH-2024-00566", name: "Ravi Pillay" },
  { accountNumber: "COJ-2024-01133", name: "Sipho Dlamini" },
];

interface AccountContextValue {
  accountNumber: string;
  setAccountNumber: (v: string) => void;
  /** Citizens are locked to the account they signed in with. */
  canSwitch: boolean;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const locked = session?.persona === "citizen" ? session.accountNumber : undefined;
  const [selected, setSelected] = useState(
    () => localStorage.getItem("xplatform.accountNumber") ?? DEMO_ACCOUNTS[0]!.accountNumber,
  );
  const update = (v: string) => {
    localStorage.setItem("xplatform.accountNumber", v);
    setSelected(v);
  };
  const value: AccountContextValue = locked
    ? { accountNumber: locked, setAccountNumber: () => undefined, canSwitch: false }
    : { accountNumber: selected, setAccountNumber: update, canSwitch: true };
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used within AccountProvider");
  return ctx;
}
