import type { Product } from '@/api/client';

/**
 * Produsul ales pe un ecran deschis deasupra cautarii (scanarea codului de bare sau adaugarea
 * unui produs propriu). Cautarea il preia cand revine in prim-plan si deschide cantitatea.
 */
let pendingProduct: Product | null = null;

export function setPendingProduct(product: Product): void {
  pendingProduct = product;
}

export function takePendingProduct(): Product | null {
  const product = pendingProduct;
  pendingProduct = null;
  return product;
}

/** Produsul propriu deschis pentru modificare. */
let editingProduct: Product | null = null;

export function setEditingProduct(product: Product | null): void {
  editingProduct = product;
}

/** Nu se goleste la citire (React poate apela de doua ori initializarea starii in dezvoltare). */
export function getEditingProduct(): Product | null {
  return editingProduct;
}
