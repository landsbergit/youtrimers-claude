import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

const STORAGE_KEY = "youtrimers_cart";

// Only the display fields we need — avoids storing the full ingredient list
export interface CartItem {
  productId: number;
  quantity: number;
  productName: string;
  imageUrl: string | null;
  productUrl: string | null;
  costUsd: number;
  servingsPerContainer: number;
  normalizedDosageForm: string | null;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Omit<CartItem, "quantity">) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  isInCart: (productId: number) => boolean;
  getQuantity: (productId: number) => number;
  totalCost: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | null>(null);

function loadFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage quota exceeded — fail silently
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadFromStorage);

  // Persist every change
  useEffect(() => {
    saveToStorage(items);
  }, [items]);

  const addToCart = useCallback((product: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.productId
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((productId: number) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.productId !== productId));
    } else {
      setItems((prev) =>
        prev.map((i) =>
          i.productId === productId ? { ...i, quantity } : i
        )
      );
    }
  }, []);

  const isInCart = useCallback(
    (productId: number) => items.some((i) => i.productId === productId),
    [items]
  );

  const getQuantity = useCallback(
    (productId: number) =>
      items.find((i) => i.productId === productId)?.quantity ?? 0,
    [items]
  );

  const totalCost = items.reduce(
    (sum, i) => sum + i.costUsd * i.quantity,
    0
  );

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        isInCart,
        getQuantity,
        totalCost,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
