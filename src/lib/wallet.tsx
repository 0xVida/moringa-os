import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { BrowserProvider, type JsonRpcSigner } from "ethers";

// ─── Wallet detection ────────────────────────────────────────────────────────

export type WalletId = "okx" | "rabby" | "metamask" | "generic";

export interface WalletOption {
  id: WalletId;
  name: string;
  provider: any;
}

function detectWallets(): WalletOption[] {
  if (typeof window === "undefined") return [];
  const eth = (window as any).ethereum;
  const seen = new Set<WalletId>();
  const result: WalletOption[] = [];

  const add = (w: WalletOption) => {
    if (!seen.has(w.id)) { seen.add(w.id); result.push(w); }
  };

  // OKX injects its own namespace — check this first
  if ((window as any).okxwallet) {
    add({ id: "okx", name: "OKX Wallet", provider: (window as any).okxwallet });
  }

  // When multiple extensions compete, some expose a providers array
  if (Array.isArray(eth?.providers)) {
    for (const p of eth.providers) {
      if (p.isRabby)                    add({ id: "rabby",    name: "Rabby",    provider: p });
      if (p.isMetaMask && !p.isRabby)   add({ id: "metamask", name: "MetaMask", provider: p });
    }
  }

  // Single provider on window.ethereum
  if (eth?.isRabby)                    add({ id: "rabby",    name: "Rabby",    provider: eth });
  if (eth?.isMetaMask && !eth?.isRabby) add({ id: "metamask", name: "MetaMask", provider: eth });

  // Generic fallback (Coinbase, Frame, etc.)
  if (result.length === 0 && eth) {
    add({ id: "generic", name: "Browser Wallet", provider: eth });
  }

  return result;
}

const WALLET_KEY = "moringa:wallet";

// ─── Context types ────────────────────────────────────────────────────────────

interface WalletState {
  address: string | null;
  signer: JsonRpcSigner | null;
  chainId: bigint | null;
  isConnecting: boolean;
  error: string | null;
  isPicking: boolean;
  detectedWallets: WalletOption[];
}

interface WalletContextType extends WalletState {
  connect: () => void;
  connectWith: (option: WalletOption) => Promise<void>;
  disconnect: () => void;
  switchToZeroGTestnet: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    address: null,
    signer: null,
    chainId: null,
    isConnecting: false,
    error: null,
    isPicking: false,
    detectedWallets: [],
  });

  // Detect wallets once on mount (client-side only)
  useEffect(() => {
    setState((s) => ({ ...s, detectedWallets: detectWallets() }));
  }, []);

  const connectWith = useCallback(async (option: WalletOption, knownAddress?: string) => {
    setState((s) => ({ ...s, isConnecting: true, isPicking: false, error: null }));
    try {
      const provider = new BrowserProvider(option.provider);
      await provider.send("eth_requestAccounts", []);
      const signer = knownAddress
        ? await provider.getSigner(knownAddress)
        : await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      localStorage.setItem(WALLET_KEY, option.id);
      setState((s) => ({
        ...s,
        address,
        signer,
        chainId: network.chainId,
        isConnecting: false,
        error: null,
      }));
    } catch (err: any) {
      setState((s) => ({ ...s, isConnecting: false, error: err?.message ?? "Connection failed" }));
    }
  }, []);

  // connect() triggers picker if >1 wallet, or connects directly
  const connect = useCallback(() => {
    const wallets = detectWallets();
    if (wallets.length === 0) {
      setState((s) => ({ ...s, error: "No wallet detected. Install OKX Wallet, Rabby, or MetaMask." }));
      return;
    }
    if (wallets.length === 1) {
      connectWith(wallets[0]);
      return;
    }
    setState((s) => ({ ...s, isPicking: true, detectedWallets: wallets }));
  }, [connectWith]);

  const disconnect = useCallback(() => {
    localStorage.removeItem(WALLET_KEY);
    setState((s) => ({
      ...s,
      address: null,
      signer: null,
      chainId: null,
      error: null,
      isPicking: false,
    }));
  }, []);

  const switchToZeroGTestnet = useCallback(async () => {
    const wallets = detectWallets();
    const savedId = localStorage.getItem(WALLET_KEY) as WalletId | null;
    const option = wallets.find((w) => w.id === savedId) ?? wallets[0];
    if (!option) return;
    try {
      await option.provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0x40DA",
            chainName: "0G Newton Testnet",
            nativeCurrency: { name: "0G", symbol: "OG", decimals: 18 },
            rpcUrls: ["https://evmrpc-testnet.0g.ai"],
            blockExplorerUrls: ["https://testnet.0gscan.ai"],
          },
        ],
      });
      await connectWith(option);
    } catch (err: any) {
      setState((s) => ({ ...s, error: err?.message ?? "Network switch failed" }));
    }
  }, [connectWith]);

  // Auto-reconnect on load using the previously chosen wallet
  const connectWithRef = useRef(connectWith);
  connectWithRef.current = connectWith;

  useEffect(() => {
    const savedId = localStorage.getItem(WALLET_KEY) as WalletId | null;
    if (!savedId) return;
    const wallets = detectWallets();
    const option = wallets.find((w) => w.id === savedId);
    if (!option) return;

    const tryReconnect = async () => {
      const accounts: string[] = await option.provider.request({ method: "eth_accounts" });
      if (accounts.length > 0) connectWithRef.current(option, accounts[0]);
    };
    tryReconnect();

    const onAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) disconnect();
      else connectWithRef.current(option, accounts[0]);
    };
    const onChainChanged = () => connectWithRef.current(option);

    option.provider.on("accountsChanged", onAccountsChanged);
    option.provider.on("chainChanged", onChainChanged);
    return () => {
      option.provider.removeListener("accountsChanged", onAccountsChanged);
      option.provider.removeListener("chainChanged", onChainChanged);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <WalletContext.Provider value={{ ...state, connect, connectWith, disconnect, switchToZeroGTestnet }}>
      {children}
    </WalletContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

// ─── Wallet picker modal ──────────────────────────────────────────────────────

const WALLET_ICONS: Record<WalletId, string> = {
  okx:      "https://static.okx.com/cdn/assets/imgs/247/58E63FEA47A2B7D7.png",
  rabby:    "https://rabby.io/assets/images/logo-rabby-64x64.png",
  metamask: "https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg",
  generic:  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='10' fill='%23666'/></svg>",
};

export function WalletPickerModal() {
  const { isPicking, detectedWallets, connectWith, disconnect } = useWallet();
  if (!isPicking) return null;

  const hasWallets = detectedWallets.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={disconnect}
    >
      <div
        className="w-full max-w-sm surface border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/60 animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-white/5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">moringa / connect</p>
          <p className="font-display text-2xl mt-1">Choose a wallet</p>
        </div>

        {/* Wallet list */}
        <div className="p-2">
          {hasWallets ? (
            detectedWallets.map((w) => (
              <button
                key={w.id}
                onClick={() => connectWith(w)}
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-white/[0.06] transition group text-left"
              >
                <div className="size-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                  <img
                    src={WALLET_ICONS[w.id]}
                    alt={w.name}
                    className="size-7 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{w.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">detected</p>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 group-hover:text-lime transition">
                  connect →
                </span>
              </button>
            ))
          ) : (
            <div className="px-4 py-8 text-center space-y-3">
              <p className="text-sm text-muted-foreground">No wallet extension detected.</p>
              <div className="flex flex-col gap-2">
                {[
                  { name: "OKX Wallet", url: "https://www.okx.com/web3" },
                  { name: "Rabby Wallet", url: "https://rabby.io" },
                  { name: "MetaMask", url: "https://metamask.io" },
                ].map((w) => (
                  <a
                    key={w.name}
                    href={w.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-lime hover:underline font-mono"
                  >
                    Install {w.name}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-2">
          <button
            onClick={disconnect}
            className="w-full py-2.5 rounded-xl surface font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
