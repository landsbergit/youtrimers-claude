import { ExternalLink, Minus, Plus, Trash2, ShoppingCart } from "lucide-react";
import { useCart, type CartItem } from "@/context/CartContext";

export default function CartSection() {
  const { items, totalCost, itemCount } = useCart();

  return (
    <section id="cart" className="px-4 pt-8 pb-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <h2
          className="font-heading text-foreground text-3xl mb-3 cursor-default"
          title="Products you've selected from your matches."
        >
          Shopping Cart
        </h2>

        {items.length === 0 ? (
          <EmptyCart />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Item list */}
            <div className="lg:col-span-2 space-y-4">
              {items.map((item) => (
                <CartItemCard key={item.productId} item={item} />
              ))}
            </div>

            {/* Summary */}
            <div className="rounded-xl border border-border bg-card p-5 sticky top-6">
              <p className="text-sm font-semibold text-foreground mb-4">Order summary</p>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Items</span>
                  <span>{itemCount}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Products</span>
                  <span>{items.length}</span>
                </div>
              </div>

              <div className="my-4 border-t border-border" />

              <div className="flex justify-between font-semibold text-foreground">
                <span>Total</span>
                <span>${totalCost.toFixed(2)}</span>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                Combined retail price of selected products. Purchase each directly from the retailer using the links below.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function CartItemCard({ item }: { item: CartItem }) {
  const { updateQuantity, removeFromCart } = useCart();

  const costPerServing = item.costUsd / item.servingsPerContainer;
  const lineTotal = item.costUsd * item.quantity;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex gap-4">
        {/* Image */}
        <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-muted border border-border">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.productName}
              className="w-full h-full object-contain p-1"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
              No img
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-foreground leading-snug line-clamp-2 flex-1">
              {item.productName}
            </p>
            {item.productUrl && (
              <a
                href={item.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 flex items-center gap-1 text-xs text-primary hover:underline"
                aria-label="Go to retailer"
              >
                Buy
                <ExternalLink size={11} />
              </a>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-1">
            <span className="font-medium text-foreground">
              ${costPerServing.toFixed(2)}/serving
            </span>
            {" · "}
            ${item.costUsd.toFixed(2)}/bottle
            {item.normalizedDosageForm && (
              <span className="ml-1 capitalize">
                · {item.normalizedDosageForm.toLowerCase()}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Quantity + line total + remove */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Quantity control */}
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
              className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Decrease quantity"
            >
              <Minus size={12} />
            </button>
            <span className="px-3 py-1.5 text-sm font-medium text-foreground border-x border-border min-w-[2.5rem] text-center">
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
              className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Increase quantity"
            >
              <Plus size={12} />
            </button>
          </div>

          <span className="text-sm font-semibold text-foreground">
            ${lineTotal.toFixed(2)}
          </span>
        </div>

        <button
          type="button"
          onClick={() => removeFromCart(item.productId)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Remove from cart"
        >
          <Trash2 size={13} />
          Remove
        </button>
      </div>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <ShoppingCart size={40} className="text-muted-foreground/40 mb-4" />
      <p className="text-muted-foreground">Your cart is empty.</p>
      <p className="text-sm text-muted-foreground/70 mt-1">
        Add products from your{" "}
        <a href="#matches" className="text-primary hover:underline">
          Matches
        </a>{" "}
        section.
      </p>
    </div>
  );
}
