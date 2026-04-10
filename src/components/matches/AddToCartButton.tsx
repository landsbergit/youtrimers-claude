import { ShoppingCart, Minus, Plus, Check } from "lucide-react";
import { useCart } from "@/context/CartContext";
import type { ProductWithIngredients } from "@/types/engine";

interface AddToCartButtonProps {
  product: ProductWithIngredients;
}

export function AddToCartButton({ product }: AddToCartButtonProps) {
  const { isInCart, getQuantity, addToCart, updateQuantity, removeFromCart } =
    useCart();

  const inCart = isInCart(product.id);
  const quantity = getQuantity(product.id);

  const handleAdd = () => {
    addToCart({
      productId: product.id,
      productName: product.productName,
      imageUrl: product.imageUrl,
      productUrl: product.productUrl,
      costUsd: product.costUsd,
      servingsPerContainer: product.servingsPerContainer,
      normalizedDosageForm: product.normalizedDosageForm,
    });
  };

  const handleDecrease = () => {
    if (quantity <= 1) {
      removeFromCart(product.id);
    } else {
      updateQuantity(product.id, quantity - 1);
    }
  };

  const handleIncrease = () => updateQuantity(product.id, quantity + 1);

  if (!inCart) {
    return (
      <button
        type="button"
        onClick={handleAdd}
        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
      >
        <ShoppingCart size={13} />
        Add to cart
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* In-cart badge */}
      <span className="flex items-center gap-1 rounded-full bg-primary/15 border border-primary/30 px-2.5 py-0.5 text-xs font-semibold text-primary">
        <Check size={12} strokeWidth={3} />
        In cart
      </span>

      {/* Quantity control */}
      <div className="flex items-center rounded-lg border border-primary/40 overflow-hidden">
        <button
          type="button"
          onClick={handleDecrease}
          className="px-2 py-1 text-primary/70 hover:text-primary hover:bg-primary/10 transition-colors"
          aria-label="Decrease quantity"
        >
          <Minus size={11} />
        </button>
        <span className="px-2.5 py-1 text-xs font-medium text-primary border-x border-primary/30 min-w-[2rem] text-center">
          {quantity}
        </span>
        <button
          type="button"
          onClick={handleIncrease}
          className="px-2 py-1 text-primary/70 hover:text-primary hover:bg-primary/10 transition-colors"
          aria-label="Increase quantity"
        >
          <Plus size={11} />
        </button>
      </div>
    </div>
  );
}
