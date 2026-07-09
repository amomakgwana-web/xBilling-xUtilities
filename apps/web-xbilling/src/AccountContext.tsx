import { createContext, useContext, useState, type ReactNode } from "react";

/** Demo account switcher standing in for real consumer login/SSO. */
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
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [accountNumber, setAccountNumber] = useState(
    () => localStorage.getItem("xbilling.accountNumber") ?? DEMO_ACCOUNTS[0]!.accountNumber,
  );
  const update = (v: string) => {
    localStorage.setItem("xbilling.accountNumber", v);
    setAccountNumber(v);
  };
  return <AccountContext.Provider value={{ accountNumber, setAccountNumber: update }}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used within AccountProvider");
  return ctx;
}
