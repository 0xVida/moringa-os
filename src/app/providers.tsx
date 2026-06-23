"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WalletProvider, WalletPickerModal } from "@/lib/wallet";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        {children}
        <WalletPickerModal />
      </WalletProvider>
    </QueryClientProvider>
  );
}
